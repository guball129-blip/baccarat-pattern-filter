
(() => {
    "use strict";
  
    const config = window.APP_CONFIG || {};
    const $ = (id) => document.getElementById(id);
    const sequence = [];
    let client = null;
    let requestNumber = 0;
  
    const setConnection = (ok, message) => {
      $("connection").textContent = ok ? "เชื่อมต่อแล้ว" : "ยังไม่พร้อม";
      $("connection").className = `rounded-full px-3 py-1 text-xs ${ok ? "bg-emerald-950 text-emerald-300" : "bg-rose-950 text-rose-300"}`;
      $("connection-detail").textContent = message;
    };
  
    function resetSignal(message = "เริ่มบันทึกผล ระบบจะเริ่มวิเคราะห์ตั้งแต่ตาที่ 6") {
      $("signal-box").className = "rounded-2xl border border-slate-700 bg-slate-900 p-5 text-center";
      $("signal-text").textContent = "รอผลการบันทึก";
      $("recommendation").textContent = message;
      $("prob-b").textContent = "—";
      $("prob-p").textContent = "—";
      $("matched-info").textContent = "0";
    }
  
    function renderHistory() {
      $("hand-count").textContent = String(sequence.length);
      const box = $("history-box");
      box.replaceChildren();
  
      if (!sequence.length) {
        const empty = document.createElement("span");
        empty.className = "text-xs italic text-slate-600";
        empty.textContent = "ยังไม่มีข้อมูล";
        box.appendChild(empty);
        return;
      }
  
      sequence.forEach((value, index) => {
        const chip = document.createElement("span");
        chip.className = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white " +
          (value === "B" ? "bg-rose-600" : value === "P" ? "bg-sky-600" : "bg-emerald-600");
        chip.textContent = value;
        chip.title = `ตาที่ ${index + 1}`;
        box.appendChild(chip);
      });
  
      box.scrollLeft = box.scrollWidth;
    }
  
    async function analyze() {
      const thisRequest = ++requestNumber;
  
      if (sequence.length < 6) {
        resetSignal();
        return;
      }
  
      if (!client) {
        resetSignal("ยังไม่ได้ตั้งค่า Supabase กรุณาตรวจสอบไฟล์ config.js");
        return;
      }
  
      $("signal-text").textContent = "กำลังวิเคราะห์...";
      $("recommendation").textContent = "กำลังค้นหารูปแบบในฐานข้อมูล";
  
      const { data, error } = await client.rpc("analyze_baccarat_system", {
        input_pattern: sequence.join(",")
      });
  
      if (thisRequest !== requestNumber) return;
  
      if (error) {
        console.error("Supabase RPC error:", error);
        $("signal-box").className = "rounded-2xl border border-rose-700 bg-rose-950/40 p-5 text-center";
        $("signal-text").textContent = "วิเคราะห์ไม่สำเร็จ";
        $("recommendation").textContent = error.message || "ตรวจสอบ SQL function, API key และสิทธิ์การใช้งาน";
        return;
      }
  
      const result = Array.isArray(data) ? data[0] : data;
  
      if (!result) {
        resetSignal("ฐานข้อมูลไม่ส่งผลวิเคราะห์กลับมา");
        return;
      }
  
      $("prob-b").textContent = `${Number(result.prob_banker).toFixed(2)}%`;
      $("prob-p").textContent = `${Number(result.prob_player).toFixed(2)}%`;
      $("matched-info").textContent = `${result.match_count} รูปแบบ`;
  
      if (String(result.signal_status).startsWith("ENTER_BET")) {
        $("signal-box").className = "rounded-2xl border border-emerald-500 bg-emerald-950/50 p-5 text-center";
        $("signal-text").textContent = `พบความถี่ในอดีตฝั่ง ${result.recommended_side}`;
      } else {
        $("signal-box").className = "rounded-2xl border border-amber-700 bg-amber-950/30 p-5 text-center";
        $("signal-text").textContent = "NO BET · ยังไม่เข้าเงื่อนไข";
      }
  
      $("recommendation").textContent =
        `${result.signal_status} · Banker ${result.banker_count} / Player ${result.player_count} / Tie ${result.tie_count}`;
    }
  
    async function testConnection() {
      if (!window.supabase?.createClient) {
        setConnection(false, "โหลด Supabase JS ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตหรือ CDN");
        return;
      }
  
      if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY ||
          config.SUPABASE_URL.includes("YOUR_PROJECT_ID") ||
          config.SUPABASE_PUBLISHABLE_KEY.includes("REPLACE_ME")) {
        setConnection(false, "กรุณาใส่ SUPABASE_URL และ SUPABASE_PUBLISHABLE_KEY ใน config.js");
        return;
      }
  
      try {
        client = window.supabase.createClient(
          config.SUPABASE_URL,
          config.SUPABASE_PUBLISHABLE_KEY
        );
  
        const { error } = await client.rpc("analyze_baccarat_system", {
          input_pattern: "B,P,B,P,B,P"
        });
  
        if (error) throw error;
  
        setConnection(true, "เชื่อมต่อ Supabase และเรียก SQL function สำเร็จ");
        await analyze();
  
      } catch (error) {
        client = null;
        console.error(error);
        setConnection(false, error.message || "เชื่อมต่อไม่สำเร็จ");
      }
    }
  
    document.querySelectorAll("[data-result]").forEach((button) => {
      button.addEventListener("click", async () => {
        sequence.push(button.dataset.result);
        renderHistory();
        await analyze();
      });
    });
  
    $("undo").addEventListener("click", async () => {
      if (sequence.length) sequence.pop();
      renderHistory();
      await analyze();
    });
  
    $("reset").addEventListener("click", () => {
      if (!confirm("ต้องการล้างผลทั้งหมดบนกระดานหรือไม่?")) return;
      sequence.length = 0;
      requestNumber++;
      renderHistory();
      resetSignal();
    });
  
    $("test-connection").addEventListener("click", testConnection);
  
    renderHistory();
    testConnection();
  })();
  
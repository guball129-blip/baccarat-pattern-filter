
(() => {
  "use strict";

  const config = window.APP_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  const sequence = [];
  let client = null;
  let requestNumber = 0;

  function setConnection(ok, message) {
    $("connection").textContent = ok ? "เชื่อมต่อแล้ว" : "ยังไม่พร้อม";
    $("connection").className =
      `rounded-full px-3 py-1 text-xs ${
        ok
          ? "bg-emerald-950 text-emerald-300"
          : "bg-rose-950 text-rose-300"
      }`;
    $("connection-detail").textContent = message;
  }

  function resetSignal(message = "เริ่มบันทึกผล ระบบจะเริ่มวิเคราะห์ตั้งแต่ตาที่ 6") {
    $("signal-box").className =
      "rounded-2xl border border-slate-700 bg-slate-900 p-5 text-center";
    $("signal-text").textContent = "รอผลการบันทึก";
    $("recommendation").textContent = message;
    $("prob-b").textContent = "—";
    $("prob-p").textContent = "—";
    $("matched-info").textContent = "0";
  }

  // สร้าง Big Road จากผล B/P/T
  function renderBigRoad() {
    const board = $("big-road");
    board.replaceChildren();

    const beads = [];
    let column = 0;
    let row = 0;
    let previous = null;
    let lastBead = null;

    sequence.forEach((value, index) => {
      // Tie ไม่สร้างช่องใหม่ แต่เพิ่มเครื่องหมายให้ผลล่าสุด
      if (value === "T") {
        if (lastBead) {
          lastBead.ties++;
        }
        return;
      }

      if (previous === null) {
        column = 0;
        row = 0;
      } else if (value === previous) {
        // ผลฝั่งเดิมพยายามลงด้านล่าง
        const nextRow = row + 1;
        const belowOccupied = beads.some(
          bead => bead.column === column && bead.row === nextRow
        );

        if (nextRow < 6 && !belowOccupied) {
          row = nextRow;
        } else {
          // ถ้าลงต่อไม่ได้ ให้ต่อแนวนอน
          column++;
          while (
            beads.some(bead => bead.column === column && bead.row === row)
          ) {
            column++;
          }
        }
      } else {
        // เปลี่ยนฝั่ง เริ่มคอลัมน์ใหม่
        column++;
        row = 0;

        while (
          beads.some(bead => bead.column === column && bead.row === row)
        ) {
          column++;
        }
      }

      const bead = {
        value,
        column,
        row,
        hand: index + 1,
        ties: 0
      };

      beads.push(bead);
      lastBead = bead;
      previous = value;
    });

    const columns = Math.max(
      12,
      beads.length ? Math.max(...beads.map(b => b.column)) + 1 : 0
    );

    // สร้างช่องว่าง 6 แถว
    for (let c = 0; c < columns; c++) {
      for (let r = 0; r < 6; r++) {
        const cell = document.createElement("div");
        cell.className = "road-cell";

        const bead = beads.find(
          item => item.column === c && item.row === r
        );

        if (bead) {
          const dot = document.createElement("div");
          dot.className =
            "road-dot " + (bead.value === "B" ? "banker" : "player");
          dot.textContent = bead.value;
          dot.title = `ตาที่ ${bead.hand}`;

          cell.appendChild(dot);

          if (bead.ties > 0) {
            const tieMark = document.createElement("span");
            tieMark.textContent =
              bead.ties > 1 ? String(bead.ties) : "T";

            tieMark.style.position = "absolute";
            tieMark.style.top = "0";
            tieMark.style.right = "0";
            tieMark.style.background = "#159447";
            tieMark.style.color = "#fff";
            tieMark.style.borderRadius = "50%";
            tieMark.style.width = "14px";
            tieMark.style.height = "14px";
            tieMark.style.fontSize = "9px";
            tieMark.style.display = "flex";
            tieMark.style.alignItems = "center";
            tieMark.style.justifyContent = "center";

            cell.appendChild(tieMark);
          }
        }

        board.appendChild(cell);
      }
    }

    // เลื่อนกระดานไปยังคอลัมน์ล่าสุด
    const wrap = board.parentElement;
    if (wrap) {
      wrap.scrollLeft = wrap.scrollWidth;
    }

    $("hand-count").textContent = String(sequence.length);
  }

  async function analyze() {
    const thisRequest = ++requestNumber;

    if (sequence.length < 6) {
      resetSignal();
      return;
    }

    if (!client) {
      resetSignal("ยังไม่ได้ตั้งค่า Supabase กรุณาตรวจสอบ config.js");
      return;
    }

    $("signal-text").textContent = "กำลังวิเคราะห์...";
    $("recommendation").textContent =
      "กำลังค้นหารูปแบบในฐานข้อมูล";

    const { data, error } = await client.rpc(
      "analyze_baccarat_system",
      {
        input_pattern: sequence.join(",")
      }
    );

    if (thisRequest !== requestNumber) return;

    if (error) {
      console.error("Supabase RPC error:", error);

      $("signal-box").className =
        "rounded-2xl border border-rose-700 bg-rose-950/40 p-5 text-center";
      $("signal-text").textContent = "วิเคราะห์ไม่สำเร็จ";
      $("recommendation").textContent =
        error.message || "ตรวจสอบ SQL function และสิทธิ์การใช้งาน";
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      resetSignal("ฐานข้อมูลไม่ส่งผลวิเคราะห์กลับมา");
      return;
    }

    $("prob-b").textContent =
      `${Number(result.prob_banker).toFixed(2)}%`;
    $("prob-p").textContent =
      `${Number(result.prob_player).toFixed(2)}%`;
    $("matched-info").textContent =
      `${result.match_count} รูปแบบ`;

    if (String(result.signal_status).startsWith("ENTER_BET")) {
      $("signal-box").className =
        "rounded-2xl border border-emerald-500 bg-emerald-950/50 p-5 text-center";
      $("signal-text").textContent =
        `พบความถี่ในอดีตฝั่ง ${result.recommended_side}`;
    } else {
      $("signal-box").className =
        "rounded-2xl border border-amber-700 bg-amber-950/30 p-5 text-center";
      $("signal-text").textContent =
        "NO BET · ยังไม่เข้าเงื่อนไข";
    }

    $("recommendation").textContent =
      `${result.signal_status} · Banker ${result.banker_count} / Player ${result.player_count} / Tie ${result.tie_count}`;
  }

  async function testConnection() {
    if (!window.supabase?.createClient) {
      setConnection(
        false,
        "โหลด Supabase JS ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตหรือ CDN"
      );
      return;
    }

    if (
      !config.SUPABASE_URL ||
      !config.SUPABASE_PUBLISHABLE_KEY ||
      config.SUPABASE_URL.includes("YOUR_PROJECT_ID") ||
      config.SUPABASE_PUBLISHABLE_KEY.includes("REPLACE_ME")
    ) {
      setConnection(
        false,
        "กรุณาตรวจสอบ SUPABASE_URL และ SUPABASE_PUBLISHABLE_KEY ใน config.js"
      );
      return;
    }

    try {
      client = window.supabase.createClient(
        config.SUPABASE_URL,
        config.SUPABASE_PUBLISHABLE_KEY
      );

      const { error } = await client.rpc(
        "analyze_baccarat_system",
        {
          input_pattern: "B,P,B,P,B,P"
        }
      );

      if (error) throw error;

      setConnection(
        true,
        "เชื่อมต่อ Supabase และเรียก SQL function สำเร็จ"
      );

      await analyze();

    } catch (error) {
      client = null;
      console.error(error);
      setConnection(false, error.message || "เชื่อมต่อไม่สำเร็จ");
    }
  }

  // ปุ่ม Banker / Player / Tie
  document.querySelectorAll("[data-result]").forEach(button => {
    button.addEventListener("click", async () => {
      sequence.push(button.dataset.result);
      renderBigRoad();
      await analyze();
    });
  });

  // Undo
  $("undo").addEventListener("click", async () => {
    if (sequence.length) {
      sequence.pop();
    }

    requestNumber++;
    renderBigRoad();
    await analyze();
  });

  // Reset
  $("reset").addEventListener("click", () => {
    if (!confirm("ต้องการล้างผลทั้งหมดบนกระดานหรือไม่?")) {
      return;
    }

    sequence.length = 0;
    requestNumber++;

    renderBigRoad();
    resetSignal();
  });

  $("test-connection").addEventListener(
    "click",
    testConnection
  );

  renderBigRoad();
  testConnection();

})();

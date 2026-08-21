// 防调试工具 - 禁止右键、F12、控制台检测
// 注意：前端无法100%阻止调试，只能增加难度

export function initAntiDebug() {
  if (typeof window === "undefined") return;

  // 1. 禁止右键菜单
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    return false;
  });

  // 2. 禁止F12、Ctrl+Shift+I、Ctrl+Shift+J、Ctrl+U等快捷键
  document.addEventListener("keydown", (e) => {
    // F12
    if (e.key === "F12") {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+I / J / C
    if (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) {
      e.preventDefault();
      return false;
    }
    // Ctrl+U (查看源码)
    if (e.ctrlKey && e.key.toUpperCase() === "U") {
      e.preventDefault();
      return false;
    }
    // Ctrl+S (保存)
    if (e.ctrlKey && e.key.toUpperCase() === "S") {
      e.preventDefault();
      return false;
    }
  });

  // 3. 控制台检测 - 如果打开了控制台，执行保护动作
  let devToolsOpen = false;
  const threshold = 160; // 控制台宽度阈值

  const checkDevTools = () => {
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    if (widthThreshold || heightThreshold) {
      if (!devToolsOpen) {
        devToolsOpen = true;
        onDevToolsOpen();
      }
    } else {
      devToolsOpen = false;
    }
  };

  const onDevToolsOpen = () => {
    // 控制台打开时的保护动作
    // 方案1：显示警告
    const warning = document.createElement("div");
    warning.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: #000; z-index: 999999; display: flex;
      align-items: center; justify-content: center;
      color: #fff; font-size: 20px; text-align: center;
      font-family: sans-serif;
    `;
    warning.innerHTML = `
      <div>
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <div style="font-size: 24px; margin-bottom: 10px;">检测到开发者工具</div>
        <div style="font-size: 14px; color: #888;">请关闭开发者工具后刷新页面</div>
      </div>
    `;
    document.body.appendChild(warning);

    // 方案2：清空页面内容（更激进，可能影响用户体验，默认注释掉）
    // document.body.innerHTML = "";
  };

  // 每1秒检测一次
  setInterval(checkDevTools, 1000);

  // 4. 禁止选择文本（可选，可能影响复制激活码，默认注释掉）
  // document.addEventListener("selectstart", (e) => {
  //   e.preventDefault();
  //   return false;
  // });

  // 5. 禁止拖拽
  document.addEventListener("dragstart", (e) => {
    e.preventDefault();
    return false;
  });
}

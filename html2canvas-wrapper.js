// 将 html2canvas 包装成一个 Promise
const html2canvasPromise = new Promise((resolve) => {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('html2canvas.min.js');
  script.onload = () => {
    // 确保 html2canvas 加载完成后再解析 Promise
    const checkLoaded = () => {
      if (window.html2canvas) {
        resolve(window.html2canvas);
      } else {
        setTimeout(checkLoaded, 10);
      }
    };
    checkLoaded();
  };
  document.head.appendChild(script);
});

export default html2canvasPromise;

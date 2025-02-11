// html2canvas worker
self.onmessage = async function(e) {
  const { type, data } = e.data;
  
  if (type === 'init') {
    try {
      // 加载 html2canvas
      importScripts(data.scriptUrl);
      
      // 确认加载成功
      if (self.html2canvas) {
        self.postMessage({ type: 'init_success', version: self.html2canvas.version });
      } else {
        throw new Error('html2canvas 加载失败');
      }
    } catch (error) {
      self.postMessage({ type: 'init_error', error: error.message });
    }
  }
};

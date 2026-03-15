import { createUpload } from './upload.js';
import { runAllVisualizations } from './visualizations/index.js';

let lastLoadedMessages = null;

document.addEventListener('DOMContentLoaded', () => {
  const upload = createUpload({
    onMessagesLoaded: (messages) => {
      lastLoadedMessages = messages;
    },
  });

  if (upload.checkEncryptedFileFromHash()) return;

  upload.renderUploadArea();
  upload.attachUploadAreaListeners();

  // Instructions platform tabs
  const instructionTabs = document.querySelectorAll('.cs-instructions-tab');
  const instructionPanels = document.querySelectorAll('.cs-instructions-panel');
  instructionTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const platform = tab.getAttribute('data-platform');
      instructionTabs.forEach((t) => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab);
      });
      instructionPanels.forEach((panel) => {
        const isActive = panel.id === 'panel-' + platform;
        panel.classList.toggle('active', isActive);
        panel.hidden = !isActive;
      });
    });
  });
});

window.addEventListener('resize', () => {
  if (lastLoadedMessages) {
    runAllVisualizations(lastLoadedMessages);
  }
});

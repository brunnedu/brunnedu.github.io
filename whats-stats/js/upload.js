import { parseWhatsAppChat, decryptChat } from './parser.js';
import { showMainSections } from './utils.js';
import { showSummary, renderParticipantSummaries } from './summary.js';
import { runAllVisualizations } from './visualizations/index.js';

export function createUpload({ onMessagesLoaded }) {
  function setStatus(msg, isSuccess = false) {
    const uploadArea = document.getElementById('upload-area');
    if (!uploadArea) return;
    const prevStatus = uploadArea.querySelector('.upload-status-message');
    if (prevStatus) prevStatus.remove();
    const statusDiv = document.createElement('div');
    statusDiv.className = 'upload-status-message';
    statusDiv.style.marginTop = '1em';
    statusDiv.style.fontWeight = '600';
    statusDiv.style.color = isSuccess ? '#00b894' : '#d63031';
    statusDiv.textContent = msg;
    uploadArea.appendChild(statusDiv);
  }

  function processChatText(text, { parsingMessage = 'Parsing chat...', successMessage = 'File parsed successfully!' } = {}) {
    setStatus(parsingMessage, true);
    let messages = [];
    try {
      messages = parseWhatsAppChat(text);
      if (!messages.length) {
        setStatus('No valid messages found. Please check your file format.');
        const summaryEl = document.getElementById('summary');
        if (summaryEl) summaryEl.innerHTML = '';
        return;
      }
      onMessagesLoaded(messages);
      setStatus(successMessage, true);
      renderUploadArea();
      attachUploadAreaListeners();
      showMainSections();
      showSummary(messages);
      renderParticipantSummaries(messages);
      runAllVisualizations(messages);
      const fileUploadSection = document.getElementById('file-upload');
      if (fileUploadSection) {
        fileUploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      setStatus('Summary error: ' + (err && err.message ? err.message : 'Unknown error.'));
      const summaryEl = document.getElementById('summary');
      if (summaryEl) summaryEl.innerHTML = '';
    }
  }

  function renderUploadArea({ encryptedMode = false, filename = '' } = {}) {
    const uploadArea = document.getElementById('upload-area');
    if (!uploadArea) return;
    uploadArea.classList.remove('success');
    if (encryptedMode) {
      uploadArea.innerHTML = `
        <div style="margin-bottom:1em; font-size:1.1em; color:#2a6ebb;">Decrypt encrypted chat file: <b>${filename}</b></div>
        <div style="position: relative; width: 80%; max-width: 320px; margin: 0 auto;">
          <input type="password" id="decrypt-password" placeholder="Enter decryption password" style="width: 100%; padding: 0.5em 2.5em 0.5em 0.5em; font-size: 1em; box-sizing: border-box;" />
          <button id="toggle-password" type="button" style="position: absolute; right: 0.5em; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #666; padding: 0.2em;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
          </button>
        </div>
        <button id="decrypt-btn" style="margin-top: 0.7em; background: #2a6ebb; color: #fff; border: none; border-radius: 5px; padding: 0.7rem 1.2rem; font-size: 1rem; font-weight: 600; cursor: pointer;">Decrypt & Load</button>
        <div id="decrypt-status" style="margin-top: 1em; font-weight: 600;"></div>
      `;
    } else {
      uploadArea.innerHTML = `
        <input type="file" id="file-input" accept=".txt,.zip" style="display: none" />
        <div class="button-container">
          <button id="sample-btn" type="button">Try Sample Chat</button>
          <div class="or-divider">or</div>
          <button id="browse-btn" type="button">Upload Your Chat</button>
        </div>
        <p>drag & drop your WhatsApp chat file</p>
      `;
    }
  }

  function attachUploadAreaListeners({ encryptedMode = false, filename = '' } = {}) {
    const uploadArea = document.getElementById('upload-area');
    if (!uploadArea) return;

    if (encryptedMode) {
      const decryptBtn = document.getElementById('decrypt-btn');
      const passwordInput = document.getElementById('decrypt-password');
      const togglePasswordBtn = document.getElementById('toggle-password');
      const statusDiv = document.getElementById('decrypt-status');

      if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
          if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            togglePasswordBtn.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
              </svg>
            `;
          } else {
            passwordInput.type = 'password';
            togglePasswordBtn.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            `;
          }
        });
      }

      if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            decryptBtn?.click();
          }
        });
      }

      if (decryptBtn && passwordInput) {
        decryptBtn.addEventListener('click', () => {
          statusDiv.textContent = 'Decrypting...';
          fetch(`encrypted-chats/${filename}`)
            .then((response) => {
              if (!response.ok) throw new Error('File not found');
              return response.text();
            })
            .then((encryptedText) => {
              const password = passwordInput.value;
              if (!password) {
                statusDiv.textContent = 'Please enter a password.';
                statusDiv.style.color = '#d63031';
                return;
              }
              const decrypted = decryptChat(encryptedText, password);
              if (!decrypted) {
                statusDiv.textContent = '❌ Failed to decrypt. Wrong password or corrupted file.';
                statusDiv.style.color = '#d63031';
                return;
              }
              statusDiv.textContent = 'Encrypted chat decrypted successfully! 🎉';
              statusDiv.style.color = '#00b894';
              try {
                const messages = parseWhatsAppChat(decrypted);
                onMessagesLoaded(messages);
                showMainSections();
                showSummary(messages);
                renderParticipantSummaries(messages);
                runAllVisualizations(messages);
              } catch (err) {
                statusDiv.textContent = '❌ Decryption succeeded, but failed to parse chat file.';
                statusDiv.style.color = '#d63031';
              }
            })
            .catch((err) => {
              statusDiv.textContent = `Error loading encrypted file: ${err.message}`;
              statusDiv.style.color = '#d63031';
            });
        });
      }
    } else {
      const fileInput = document.getElementById('file-input');
      const browseBtn = document.getElementById('browse-btn');
      const sampleBtn = document.getElementById('sample-btn');

      if (browseBtn && fileInput) {
        browseBtn.addEventListener('click', () => fileInput.click());
      }

      if (sampleBtn) {
        sampleBtn.addEventListener('click', () => {
          setStatus('Loading sample chat...', true);
          fetch('assets/WhatsApp Chat Sample.txt')
            .then((response) => {
              if (!response.ok) throw new Error('Failed to load sample file');
              return response.text();
            })
            .then((text) => {
              processChatText(text, {
                parsingMessage: 'Parsing sample chat...',
                successMessage: 'Sample chat loaded successfully!',
              });
            })
            .catch((error) => {
              setStatus('Error loading sample file: ' + error.message);
            });
        });
      }

      if (fileInput) {
        fileInput.addEventListener('change', (e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0]);
        });
      }

      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
      });
      uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
      });
      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
      });
    }
  }

  function handleFile(file) {
    const isZip = file.name.toLowerCase().endsWith('.zip');
    const isTxt = file.name.toLowerCase().endsWith('.txt');
    if (!isTxt && !isZip) {
      setStatus('Please upload a .txt or .zip file exported from WhatsApp.');
      return;
    }
    const maxSize = isZip ? 15 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setStatus(`File is too large. Please upload a file smaller than ${isZip ? '15' : '5'}MB.`);
      return;
    }

    if (isZip) {
      setStatus('Extracting zip...', true);
      const reader = new FileReader();
      reader.onload = (e) => {
        JSZip.loadAsync(e.target.result)
          .then((zip) => {
            const txtFiles = Object.keys(zip.files).filter(
              (name) => name.toLowerCase().endsWith('.txt') && !zip.files[name].dir
            );
            if (txtFiles.length === 0) {
              setStatus('No .txt file found inside the zip. Please check your export.');
              return;
            }
            return zip.files[txtFiles[0]].async('string');
          })
          .then((text) => {
            if (text) processChatText(text);
          })
          .catch((err) => {
            setStatus('Error reading zip: ' + (err?.message ?? 'Invalid or corrupted zip.'));
          });
      };
      reader.onerror = () => setStatus('Error reading file. Please try again.');
      reader.readAsArrayBuffer(file);
    } else {
      setStatus('Reading file...', true);
      const reader = new FileReader();
      reader.onload = (e) => processChatText(e.target.result);
      reader.onerror = () => setStatus('Error reading file. Please try again.');
      reader.readAsText(file);
    }
  }

  function checkEncryptedFileFromHash() {
    if (window.location.hash.startsWith('#file=')) {
      const filename = window.location.hash.slice(6);
      if (!filename.endsWith('.enc.txt')) return true;
      renderUploadArea({ encryptedMode: true, filename });
      attachUploadAreaListeners({ encryptedMode: true, filename });
      return true;
    }
    return false;
  }

  return {
    checkEncryptedFileFromHash,
    renderUploadArea,
    attachUploadAreaListeners,
  };
}

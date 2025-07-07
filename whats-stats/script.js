// WhatsApp Chat Analyzer - Main JS
// Phase 3: Parsing and summary statistics

function showMainSections() {
  document.getElementById('summary')?.classList.remove('hidden-on-load');
  document.getElementById('participant-summary-section')?.classList.remove('hidden-on-load');
  document.getElementById('visualizations')?.classList.remove('hidden-on-load');
}

function countWordOccurrences(messages, { byParticipant = false, ngram = 1, skipEmojis = false } = {}) {
  // Clean phrases to remove
  const cleanPhrases = [
    /<Media omitted>/gi,
    /<This message was edited>/gi,
    /This message was deleted/gi,
    /live location shared/gi
  ];
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  // Helper to clean and split message
  function getWords(msg) {
    let cleaned = msg;
    cleanPhrases.forEach(re => { cleaned = cleaned.replace(re, ''); });
    let words = cleaned.split(/\s+/)
      .map(word => word.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, ''))
      .filter(Boolean);
    if (skipEmojis) {
      words = words.filter(w => !emojiRegex.test(w));
    }
    return words;
  }
  if (byParticipant) {
    // { user: { word: count } }
    const counts = {};
    messages.forEach(m => {
      if (!m.user) return; // Skip system messages or group modifications
      if (!counts[m.user]) counts[m.user] = {};
      const words = getWords(m.message);
      for (let i = 0; i <= words.length - ngram; i++) {
        const gram = words.slice(i, i + ngram).join(' ');
        if (gram) counts[m.user][gram] = (counts[m.user][gram] || 0) + 1;
      }
    });
    return counts;
  } else {
    // { word: count }
    const counts = {};
    messages.forEach(m => {
      if (!m.user) return; // Skip system messages or group modifications
      const words = getWords(m.message);
      for (let i = 0; i <= words.length - ngram; i++) {
        const gram = words.slice(i, i + ngram).join(' ');
        if (gram) counts[gram] = (counts[gram] || 0) + 1;
      }
    });
    return counts;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const uploadStatus = document.getElementById('upload-status');
  const summaryDiv = document.querySelector('.summary-placeholder');

  // Helper: Show status
  function setStatus(msg, isSuccess = false) {
    // Remove any previous status or success message
    const prevStatus = uploadArea.querySelector('.upload-status-message');
    if (prevStatus) prevStatus.remove();
    // Insert new status message inside upload area
    const statusDiv = document.createElement('div');
    statusDiv.className = 'upload-status-message';
    statusDiv.style.marginTop = '1em';
    statusDiv.style.fontWeight = '600';
    statusDiv.style.color = isSuccess ? '#00b894' : '#d63031';
    statusDiv.textContent = msg;
    uploadArea.appendChild(statusDiv);
  }

  // Click browse button triggers file input
  browseBtn.addEventListener('click', () => fileInput.click());

  // Handle file input change
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  // Drag & drop events
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  // Core file handler
  function handleFile(file) {
    if (!file.name.endsWith('.txt')) {
      setStatus('Please upload a .txt file exported from WhatsApp.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setStatus('File is too large. Please upload a file smaller than 5MB.');
      return;
    }
    setStatus('Reading file...', true);
    const reader = new FileReader();
    reader.onload = function (e) {
      setStatus('Parsing chat...', true);
      const text = e.target.result;
      let messages = [];
      try {
        messages = parseWhatsAppChat(text);
        lastLoadedMessages = messages; // store globally for resize
        if (!messages.length) {
          setStatus('No valid messages found. Please check your file format.');
          summaryDiv.innerHTML = '';
          return;
        }
        setStatus('File parsed successfully!', true);
        // Show green upload area and success message inside
        uploadArea.classList.add('success');
        uploadArea.innerHTML = `<input type="file" id="file-input" accept=".txt" style="display:none" />
          <button id="browse-btn" type="button">Browse .txt File</button>
          <p>or drag and drop your WhatsApp chat .txt file here</p>
          <div class="upload-success-message" style="color:#00b894; font-weight:600; margin-top:1em;">Export parsed successfully! 🎉</div>`;
        // Re-attach event listeners for file input and browse button
        const newFileInput = uploadArea.querySelector('#file-input');
        const newBrowseBtn = uploadArea.querySelector('#browse-btn');
        newBrowseBtn.addEventListener('click', () => newFileInput.click());
        newFileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        });
        showMainSections();
        showSummary(messages);
        renderParticipantSummaries(messages);
        renderWordCloud(messages); // Call renderWordCloud after parsing
        // Smooth scroll to chat summary
        const fileUploadSection = document.getElementById('file-upload');
        if (fileUploadSection) {
          fileUploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (err) {
        setStatus('Summary error: ' + (err && err.message ? err.message : 'Unknown error.'));
        summaryDiv.innerHTML = '';
        return;
      }
      // Render visualizations, catch errors per chart
      try { renderActivityOverTime(messages); } catch (err) { showVizError('viz-activity-over-time', err); }
      try { renderMessagesByParticipant(messages); } catch (err) { showVizError('viz-messages-by-participant', err); }
      try { renderHourlyActivity(messages); } catch (err) { showVizError('viz-hourly-activity', err); }
      try { renderLongestStreaks(messages); } catch (err) { showVizError('viz-longest-streaks', err); }
      try { renderWeeklyHeatmap(messages); } catch (err) { showVizError('viz-weekly-heatmap', err); }
      try { renderEmojiChart(messages); } catch (err) { showVizError('viz-emojis', err); }
      try { renderResponseTimeHistogram(messages); } catch (err) { showVizError('viz-response-time', err); }
      try { renderMostUsedWords(messages); } catch (err) { showVizError('viz-most-used-words', err); }
      try { renderActivityOverTimeGrouped(messages); } catch (err) { showVizError('viz-activity-over-time-grouped', err); }
      try { renderActivityOverTimeStackedPercent(messages); } catch (err) { showVizError('viz-activity-over-time-stacked-percent', err); }
      try { renderMessageLengthHistogram(messages); } catch (err) { showVizError('viz-message-length-histogram', err); }
    };
    reader.onerror = function () {
      setStatus('Error reading file. Please try again.');
    };
    reader.readAsText(file);
  }

  // Parse WhatsApp chat into array of {timestamp, user, message}
  function parseWhatsAppChat(text) {
    // Regex for WhatsApp user message: {DATE}, {TIME} - {USER}: {MESSAGE}
    const userMsgRegex = /^(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),? (\d{1,2}:\d{2})[ \t]*[\-\u2013][ \t]*(.+?): (.*)$/u;
    const lines = text.split(/\r?\n/);
    const messages = [];
    for (let line of lines) {
      const match = line.match(userMsgRegex);
      if (match) {
        const [_, date, time, user, message] = match;
        const timestamp = parseDateTime(date, time);
        messages.push({ timestamp, user: user.trim(), message: message.trim() });
      }
      // else: skip meta/system messages
    }
    return messages;
  }

  // Parse date and time to ISO string
  function parseDateTime(date, time) {
    // Try MM/DD/YY, DD.MM.YYYY, etc.
    let d, parts;
    if (date.includes('/')) {
      // US: MM/DD/YY or MM/DD/YYYY
      parts = date.split('/');
      let year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      d = new Date(`${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}T${time}`);
    } else if (date.includes('.')) {
      // EU: DD.MM.YYYY
      parts = date.split('.');
      let year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      d = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T${time}`);
    } else {
      d = new Date(date + 'T' + time);
    }
    return d.toISOString();
  }

  // Show summary statistics in the UI
  function showSummary(messages) {
    // Total messages
    const totalMessages = messages.length;
    // Participants
    const participants = Array.from(new Set(messages.map(m => m.user)));
    // Date range
    const dates = messages.map(m => new Date(m.timestamp));
    const firstDate = new Date(Math.min(...dates));
    const lastDate = new Date(Math.max(...dates));
    // Total characters
    const totalChars = messages.reduce((sum, m) => sum + m.message.length, 0);
    // Messages per day
    const dayCounts = {};
    messages.forEach(m => {
      const day = m.timestamp.slice(0, 10);
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    const avgPerDay = (totalMessages / Object.keys(dayCounts).length).toFixed(2);
    // Most active day
    const mostActiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
    // Most active hour
    const hourCounts = {};
    messages.forEach(m => {
      const hour = new Date(m.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const mostActiveHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];

    // Render summary cards directly inside #summary (after h3)
    const summarySection = document.getElementById('summary');
    // Remove any previous summary cards
    Array.from(summarySection.querySelectorAll('.summary-cards')).forEach(el => el.remove());
    const cards = document.createElement('div');
    cards.className = 'summary-cards';
    cards.innerHTML = `
      <div class="summary-card"><strong>Total Messages</strong><br>${totalMessages}</div>
      <div class="summary-card"><strong>Participants</strong><br>${participants.length}</div>
      <div class="summary-card"><strong>Date Range</strong><br>${firstDate.toLocaleDateString()} – ${lastDate.toLocaleDateString()}</div>
      <div class="summary-card"><strong>Total Characters</strong><br>${totalChars}</div>
      <div class="summary-card"><strong>Avg. Messages/Day</strong><br>${avgPerDay}</div>
      <div class="summary-card"><strong>Most Active Day</strong><br>${mostActiveDay ? mostActiveDay[0] + ' (' + mostActiveDay[1] + ')' : '-'}</div>
      <div class="summary-card"><strong>Most Active Hour</strong><br>${mostActiveHour ? mostActiveHour[0] + ':00 (' + mostActiveHour[1] + ')' : '-'}</div>
    `;
    summarySection.appendChild(cards);
  }

  // Global Plotly chart style parameters
  const PLOTLY_TITLE_SIZE = 20;
  const PLOTLY_TICK_FONT_SIZE = 14;
  const PLOTLY_LEFT_MARGIN = 80;

  // Plotly Visualization: Message Activity Over Time
  function renderActivityOverTime(messages) {
    const container = document.getElementById('viz-activity-over-time');
    container.innerHTML = '';
    // Prepare data: count messages per week
    const weekCounts = {};
    messages.forEach(m => {
      const date = new Date(m.timestamp);
      const year = date.getFullYear();
      const week = getWeekNumber(date);
      const weekStr = `${year}-W${week.toString().padStart(2, '0')}`;
      weekCounts[weekStr] = (weekCounts[weekStr] || 0) + 1;
    });
    const data = Object.entries(weekCounts).map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week));
    if (data.length === 0) {
      container.textContent = 'No data to display.';
      return;
    }
    const trace = {
      x: data.map(d => d.week),
      y: data.map(d => d.count),
      type: 'scatter',
      mode: 'lines+markers',
      marker: { color: '#2a6ebb' },
      line: { color: '#2a6ebb', width: 3 },
      hovertemplate: 'Week %{x}<br>%{y} messages<extra></extra>'
    };
    const layout = {
      title: { text: 'Messages Over Time', font: { size: PLOTLY_TITLE_SIZE } },
      margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 60, b: 60 },
      xaxis: {
        title: 'Week',
        tickangle: -30,
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true,
        type: 'category',
        nticks: Math.min(12, data.length)
      },
      yaxis: {
        title: 'Messages',
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true
      },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      showlegend: false,
      width: container.offsetWidth,
      height: 320
    };
    Plotly.newPlot(container, [trace], layout, {responsive: true});
  }


  // Plotly Visualization: Hourly Activity Distribution (grouped by participant)
  function renderHourlyActivity(messages) {
    const container = document.getElementById('viz-hourly-activity');
    container.innerHTML = '';
    // Prepare data: count messages per hour per participant
    let participants = Array.from(new Set(messages.map(m => m.user)));
    // Count total messages per participant
    const totalMessagesByUser = {};
    participants.forEach(user => { totalMessagesByUser[user] = 0; });
    messages.forEach(m => { totalMessagesByUser[m.user] = (totalMessagesByUser[m.user] || 0) + 1; });
    // Sort participants by total messages descending
    participants = participants.sort((a, b) => totalMessagesByUser[b] - totalMessagesByUser[a]);
    const hourCountsByUser = {};
    participants.forEach(user => {
      hourCountsByUser[user] = Array(24).fill(0);
    });
    messages.forEach(m => {
      const hour = new Date(m.timestamp).getHours();
      hourCountsByUser[m.user][hour]++;
    });
    // Normalize by participant: fraction of their messages per hour
    const hourFractionsByUser = {};
    participants.forEach(user => {
      const total = totalMessagesByUser[user] || 1;
      hourFractionsByUser[user] = hourCountsByUser[user].map(count => count / total);
    });
    const participantColors = [
      '#2a6ebb', '#00b894', '#0984e3', '#00cec9', '#6c5ce7', '#fdcb6e', '#e17055', '#636e72'
    ];
    const traces = participants.map((user, idx) => ({
      x: Array.from({ length: 24 }, (_, i) => i),
      y: hourFractionsByUser[user],
      name: user,
      type: 'bar',
      marker: { color: participantColors[idx % participantColors.length] },
      hovertemplate: `${user}<br>Hour %{x}:00<br>%{y:.2f} of messages<extra></extra>`
    }));
    const layout = {
      title: { text: 'Hourly Activity Distribution by Participant', font: { size: PLOTLY_TITLE_SIZE } },
      margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 100, b: 80 },
      barmode: 'group',
      xaxis: {
        title: 'Hour',
        tickmode: 'array',
        tickvals: [0, 4, 8, 12, 16, 20, 23],
        ticktext: ['0', '4', '8', '12', '16', '20', '23'],
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true
      },
      yaxis: {
        title: 'Fraction of Messages',
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true,
      },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      width: container.offsetWidth,
      height: 680
    };
    Plotly.newPlot(container, traces, layout, {responsive: true});
  }

  // Plotly Visualization: Longest Streak by Participant
  function renderLongestStreaks(messages) {
    const container = document.getElementById('viz-longest-streaks');
    container.innerHTML = '';
  
    // Get unique participants
    let participants = Array.from(new Set(messages.map(m => m.user)));
  
    // Count total messages per participant
    const totalMessagesByUser = {};
    participants.forEach(user => { totalMessagesByUser[user] = 0; });
    messages.forEach(m => { totalMessagesByUser[m.user] = (totalMessagesByUser[m.user] || 0) + 1; });
  
    // Sort participants by total messages descending (optional, can be changed)
    participants = participants.sort((a, b) => totalMessagesByUser[b] - totalMessagesByUser[a]);
  
    // Compute longest streaks per participant
    let streaks = participants.map(user => {
      const userMsgs = messages.filter(m => m.user === user);
      const dateSet = new Set(userMsgs.map(m => new Date(m.timestamp).toISOString().slice(0, 10)));
      const dates = Array.from(dateSet).sort();
  
      let maxStreak = 0;
      let currentStreak = 1;
      let maxStart = null;
      let maxEnd = null;
      let streakStart = null;
  
      for (let i = 0; i < dates.length; i++) {
        if (i === 0) {
          streakStart = dates[i];
          continue;
        }
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diff = (curr - prev) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          currentStreak++;
        } else {
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
            maxStart = streakStart;
            maxEnd = dates[i - 1];
          }
          currentStreak = 1;
          streakStart = dates[i];
        }
      }
      // Check last streak
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
        maxStart = streakStart;
        maxEnd = dates[dates.length - 1];
      }
      return {
        user,
        maxStreak,
        maxStart,
        maxEnd
      };
    });
  
    // Sort streaks descending by maxStreak
    streaks.sort((a, b) => b.maxStreak - a.maxStreak);
  
    // Reverse to have longest streaks at top of horizontal bar chart
    const participantColors = [
      '#2a6ebb', '#00b894', '#0984e3', '#00cec9', '#6c5ce7', '#fdcb6e', '#e17055', '#636e72'
    ];
  
    const users = streaks.map(s => s.user).reverse();
    const maxStreaks = streaks.map(s => s.maxStreak).reverse();
    const texts = streaks.map(s => s.maxStreak > 0 ? `${s.maxStart} → ${s.maxEnd}` : 'No streak').reverse();
    const colors = streaks.map((_, idx) => participantColors[idx % participantColors.length]).reverse();
  
    const traces = [{
      x: maxStreaks,
      y: users,
      text: texts,
      textposition: 'auto',
      type: 'bar',
      orientation: 'h',
      marker: { color: colors },
      hovertemplate: '%{y}<br>Longest streak: %{x} days<br>%{text}<extra></extra>'
    }];
  
    const layout = {
      title: { text: 'Longest Streak by Participant (Consecutive Days with Messages)', font: { size: PLOTLY_TITLE_SIZE } },
      margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 100, b: 60 },
      xaxis: {
        title: 'Longest Streak (days)',
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true
      },
      yaxis: {
        title: 'Participant',
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true,
        // No categoryorder needed due to explicit reversal
      },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      width: container.offsetWidth,
      height: 200 + streaks.length * 30
    };
  
    Plotly.newPlot(container, traces, layout, { responsive: true });
  }
  

  // Plotly Visualization: Weekly Pattern Heatmap
  function renderWeeklyHeatmap(messages) {
    const container = document.getElementById('viz-weekly-heatmap');
    container.innerHTML = '';
    // Prepare data: count messages by day of week and hour
    const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
    messages.forEach(m => {
      const date = new Date(m.timestamp);
      const day = date.getDay();
      const hour = date.getHours();
      heatmap[day][hour]++;
    });
    const z = heatmap;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const trace = {
      z: z,
      x: hours,
      y: days,
      type: 'heatmap',
      colorscale: 'YlGnBu',
      hoverongaps: false,
      colorbar: { title: 'Messages' },
      hovertemplate: '%{y}, %{x}:00<br>%{z} messages<extra></extra>'
    };
    const layout = {
      title: { text: 'Weekly Pattern', font: { size: PLOTLY_TITLE_SIZE } },
      margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 60, b: 60 },
      xaxis: {
        title: 'Hour',
        tickmode: 'array',
        tickvals: [0, 4, 8, 12, 16, 20, 23],
        ticktext: ['0', '4', '8', '12', '16', '20', '23'],
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true
      },
      yaxis: {
        title: 'Day',
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true
      },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      width: container.offsetWidth,
      height: 340
    };
    Plotly.newPlot(container, [trace], layout, {responsive: true});
  }

  // Plotly Visualization: Most Used Emojis
  function renderEmojiChart(messages) {
    const container = document.getElementById('viz-emojis');
    container.innerHTML = '';
    // Use unified function for emoji counting
    const emojiCounts = countEmojiOccurrences(messages);
    // Add variation selector to legacy emoji for color rendering
    function withVariationSelector(emoji) {
      // List of legacy emoji codepoints that need VS16 for color
      const legacy = ['\u263A', '\u2665', '\u2660', '\u2663', '\u2666', '\u2600', '\u2601', '\u2602', '\u2603', '\u260E', '\u2614', '\u2615', '\u2648', '\u2649', '\u264A', '\u264B', '\u264C', '\u264D', '\u264E', '\u264F', '\u2650', '\u2651', '\u2652', '\u2653'];
      // If emoji is a single codepoint and matches legacy, add VS16
      if (emoji.length === 1 && legacy.includes('\\u' + emoji.charCodeAt(0).toString(16).toUpperCase())) {
        return emoji + '\uFE0F';
      }
      // Also handle some common ones
      if (emoji === '☺') return '\u263A\uFE0F';
      if (emoji === '♥') return '\u2665\uFE0F';
      return emoji;
    }
    let data = Object.entries(emojiCounts).map(([emoji, count]) => ({ emoji: withVariationSelector(emoji), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20
    if (data.length === 0) {
      container.textContent = 'No emojis found.';
      return;
    }
    const emojiFontStack = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", "EmojiOne Color", "Android Emoji", sans-serif';
    const trace = {
      x: data.map(d => d.emoji),
      y: data.map(d => d.count),
      type: 'bar',
      marker: { color: '#2a6ebb' },
      hovertemplate: '%{y}<br>%{x} uses<extra></extra>'
    };
    const layout = {
      title: { text: 'Most Used Emojis', font: { size: PLOTLY_TITLE_SIZE } },
      margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 60, b: 80 },
      xaxis: {
        title: 'Emoji',
        tickfont: { size: 24, family: emojiFontStack },
        automargin: true
      },
      yaxis: {
        title: 'Count',
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true
      },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      showlegend: false,
      width: container.offsetWidth,
      height: 340
    };
    Plotly.newPlot(container, [trace], layout, {responsive: true});
  }

  // Plotly Visualization: Most Used Words
  function renderMostUsedWords(messages) {
    const container = document.getElementById('viz-most-used-words');
    container.innerHTML = '';
    // Use unified function for trigram (3-word sequence) frequencies
    const trigramCounts = countWordOccurrences(messages, { ngram: 3 });
    let data = Object.entries(trigramCounts).map(([trigram, count]) => ({ trigram, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20
    if (data.length === 0) {
      container.textContent = 'No 3-word sequences found.';
      return;
    }
    const trace = {
      x: data.map(d => d.count),
      y: data.map(d => d.trigram),
      type: 'bar',
      orientation: 'h',
      marker: { color: '#2a6ebb' },
      hovertemplate: '%{y}<br>%{x} uses<extra></extra>'
    };
    const layout = {
      title: { text: 'Top 3-Word Sequences', font: { size: PLOTLY_TITLE_SIZE } },
      margin: { l: PLOTLY_LEFT_MARGIN + 60, r: 30, t: 60, b: 60 },
      xaxis: {
        title: 'Count',
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true
      },
      yaxis: {
        title: '3-Word Sequence',
        tickfont: { size: 16 },
        automargin: true,
        categoryorder: 'total ascending'
      },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      showlegend: false,
      width: container.offsetWidth,
      height: Math.max(220, data.length * 36 + 120)
    };
    Plotly.newPlot(container, [trace], layout, {responsive: true});
  }

  // Plotly Visualization: Message Activity Over Time (Grouped by Participant, per week)
  function renderActivityOverTimeGrouped(messages) {
    const container = document.getElementById('viz-activity-over-time-grouped');
    container.innerHTML = '';
    // Prepare data: count messages per week per participant
    let participants = Array.from(new Set(messages.map(m => m.user)));
    // Count total messages per participant
    const totalMessagesByUser = {};
    participants.forEach(user => { totalMessagesByUser[user] = 0; });
    messages.forEach(m => { totalMessagesByUser[m.user] = (totalMessagesByUser[m.user] || 0) + 1; });
    // Sort participants by total messages descending
    participants = participants.sort((a, b) => totalMessagesByUser[b] - totalMessagesByUser[a]);
    const weekCountsByUser = {};
    participants.forEach(user => { weekCountsByUser[user] = {}; });
    messages.forEach(m => {
      const date = new Date(m.timestamp);
      // Get ISO week string: YYYY-Www
      const year = date.getFullYear();
      const week = getWeekNumber(date);
      const weekStr = `${year}-W${week.toString().padStart(2, '0')}`;
      weekCountsByUser[m.user][weekStr] = (weekCountsByUser[m.user][weekStr] || 0) + 1;
    });
    // Get all week keys sorted
    const allWeeks = Array.from(new Set(Object.values(weekCountsByUser).flatMap(obj => Object.keys(obj)))).sort();
    // Prepare traces
    const participantColors = [
      '#2a6ebb', '#00b894', '#0984e3', '#00cec9', '#6c5ce7', '#fdcb6e', '#e17055', '#636e72'
    ];
    const traces = participants.map((user, idx) => ({
      x: allWeeks,
      y: allWeeks.map(week => weekCountsByUser[user][week] || 0),
      name: user,
      type: 'scatter',
      mode: 'lines+markers',
      marker: { color: participantColors[idx % participantColors.length] },
      line: { color: participantColors[idx % participantColors.length], width: 3 },
      hovertemplate: `${user}<br>Week %{x}<br>%{y} messages<extra></extra>`
    }));
    if (traces.every(trace => trace.y.every(y => y === 0))) {
      container.textContent = 'No data to display.';
      return;
    }
    const layout = {
      title: { text: 'Message Activity Over Time (Grouped by Participant, per Week)', font: { size: PLOTLY_TITLE_SIZE } },
      margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 100, b: 80 },
      xaxis: {
        title: 'Week',
        tickangle: -30,
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true,
        type: 'category',
        nticks: Math.min(12, allWeeks.length)
      },
      yaxis: {
        title: 'Messages per Week',
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true
      },
      plot_bgcolor: 'rgba(0,0,0,0)',  // transparent plot area
      paper_bgcolor: 'rgba(0,0,0,0)', // transparent entire chart background
      width: container.offsetWidth,
      height: 680
    };
    Plotly.newPlot(container, traces, layout, {responsive: true});
  }
  // Helper: Get ISO week number (1-53)
  function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
  }

  // Plotly Visualization: Message Activity Over Time (Stacked Area, Percent by Participant, per month)
  function renderActivityOverTimeStackedPercent(messages) {
    const container = document.getElementById('viz-activity-over-time-stacked-percent');
    container.innerHTML = '';
    // Prepare data: count messages per month per participant
    let participants = Array.from(new Set(messages.map(m => m.user)));
    // Count total messages per participant
    const totalMessagesByUser = {};
    participants.forEach(user => { totalMessagesByUser[user] = 0; });
    messages.forEach(m => { totalMessagesByUser[m.user] = (totalMessagesByUser[m.user] || 0) + 1; });
    // Sort participants by total messages descending
    participants = participants.sort((a, b) => totalMessagesByUser[a] - totalMessagesByUser[b]);
    const monthCountsByUser = {};
    participants.forEach(user => { monthCountsByUser[user] = {}; });
    messages.forEach(m => {
      const date = new Date(m.timestamp);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const monthStr = `${year}-${month}`;
      monthCountsByUser[m.user][monthStr] = (monthCountsByUser[m.user][monthStr] || 0) + 1;
    });
    // Get all month keys sorted
    const allMonths = Array.from(new Set(Object.values(monthCountsByUser).flatMap(obj => Object.keys(obj)))).sort();
    // Compute total messages per month
    const totalPerMonth = allMonths.map(month => participants.reduce((sum, user) => sum + (monthCountsByUser[user][month] || 0), 0));
    // Prepare traces as percent
    const participantColors = [
      '#2a6ebb', '#00b894', '#0984e3', '#00cec9', '#6c5ce7', '#fdcb6e', '#e17055', '#636e72'
    ];
    const traces = participants.map((user, idx) => ({
      x: allMonths,
      y: allMonths.map((month, i) => {
        const count = monthCountsByUser[user][month] || 0;
        const total = totalPerMonth[i] || 1;
        return (count / total) * 100;
      }),
      name: user,
      type: 'scatter',
      mode: 'lines',
      stackgroup: 'one',
      groupnorm: 'percent',
      marker: { color: participantColors[idx % participantColors.length] },
      line: { width: 0.5 },
      hovertemplate: `${user}<br>Month %{x}<br>%{y:.1f}% of messages<extra></extra>`
    }));
    if (traces.every(trace => trace.y.every(y => y === 0))) {
      container.textContent = 'No data to display.';
      return;
    }
    const layout = {
      title: { text: 'Message Activity Over Time (Stacked Area, % by Participant, per Month)', font: { size: PLOTLY_TITLE_SIZE } },
      margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 100, b: 80 },
      xaxis: {
        title: 'Month',
        tickangle: -30,
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true,
        type: 'category',
        nticks: Math.min(12, allMonths.length)
      },
      yaxis: {
        title: 'Share of Messages (%)',
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true,
        range: [0, 100]
      },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      width: container.offsetWidth,
      height: 680
    };
    Plotly.newPlot(container, traces, layout, {responsive: true});
  }

  // Plotly Visualization: Histogram of Message Lengths (in characters)
  function renderMessageLengthHistogram(messages) {
    const container = document.getElementById('viz-message-length-histogram');
    container.innerHTML = '';
    const lengths = messages.map(m => m.message.length);
    if (lengths.length === 0) {
      container.textContent = 'No messages to display.';
      return;
    }
    const trace = {
      x: lengths,
      type: 'histogram',
      marker: { color: '#2a6ebb' },
      nbinsx: 200,
      hovertemplate: '%{x} characters: %{y} messages<extra></extra>'
    };
    const layout = {
      title: { text: 'Message Lengths', font: { size: PLOTLY_TITLE_SIZE } },
      margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 60, b: 60 },
      xaxis: {
        title: 'Length (characters)',
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true,
      },
      yaxis: {
        title: 'Messages',
        tickfont: { size: PLOTLY_TICK_FONT_SIZE },
        automargin: true,
        type: 'log',
      },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      showlegend: false,
      width: container.offsetWidth,
      height: 340
    };
    Plotly.newPlot(container, [trace], layout, {responsive: true});
  }

  // Unified word/ngram counting function
  function countWordOccurrences(messages, { byParticipant = false, ngram = 1, skipEmojis = false } = {}) {
    // Clean phrases to remove
    const cleanPhrases = [
      /<Media omitted>/gi,
      /<This message was edited>/gi,
      /This message was deleted/gi,
      /live location shared/gi
    ];
    const emojiRegex = /\p{Extended_Pictographic}/gu;
    // Helper to clean and split message
    function getWords(msg) {
      let cleaned = msg;
      cleanPhrases.forEach(re => { cleaned = cleaned.replace(re, ''); });
      let words = cleaned.split(/\s+/)
        .map(word => word.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, ''))
        .filter(Boolean);
      if (skipEmojis) {
        words = words.filter(w => !emojiRegex.test(w));
      }
      return words;
    }
    if (byParticipant) {
      // { user: { word: count } }
      const counts = {};
      messages.forEach(m => {
        if (!m.user) return; // Skip system messages or group modifications
        if (!counts[m.user]) counts[m.user] = {};
        const words = getWords(m.message);
        for (let i = 0; i <= words.length - ngram; i++) {
          const gram = words.slice(i, i + ngram).join(' ');
          if (gram) counts[m.user][gram] = (counts[m.user][gram] || 0) + 1;
        }
      });
      return counts;
    } else {
      // { word: count }
      const counts = {};
      messages.forEach(m => {
        if (!m.user) return; // Skip system messages or group modifications
        const words = getWords(m.message);
        for (let i = 0; i <= words.length - ngram; i++) {
          const gram = words.slice(i, i + ngram).join(' ');
          if (gram) counts[gram] = (counts[gram] || 0) + 1;
        }
      });
      return counts;
    }
  }

  // Unified emoji counting function
  function countEmojiOccurrences(messages, { byParticipant = false } = {}) {
    const emojiRegex = /\p{Extended_Pictographic}/gu;
    const genderSigns = ['\u2640', '\u2642', '\u2640\uFE0F', '\u2642\uFE0F', '♀', '♂', '♀️', '♂️'];
    if (byParticipant) {
      const counts = {};
      messages.forEach(m => {
        if (!counts[m.user]) counts[m.user] = {};
        const emojis = Array.from(m.message.matchAll(emojiRegex), m => m[0]);
        for (let i = 0; i < emojis.length; i++) {
          if (genderSigns.includes(emojis[i])) continue;
          counts[m.user][emojis[i]] = (counts[m.user][emojis[i]] || 0) + 1;
        }
      });
      return counts;
    } else {
      const counts = {};
      messages.forEach(m => {
        const emojis = Array.from(m.message.matchAll(emojiRegex), m => m[0]);
        for (let i = 0; i < emojis.length; i++) {
          if (genderSigns.includes(emojis[i])) continue;
          counts[emojis[i]] = (counts[emojis[i]] || 0) + 1;
        }
      });
      return counts;
    }
  }

  // Helper to show error messages in visualization containers
  function showVizError(containerId, err) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = ''; // Clear previous content
      container.textContent = 'Error rendering chart: ' + (err && err.message ? err.message : 'Unknown error.');
      container.style.color = '#ff6b6b'; // Red color for error
      container.style.fontWeight = 'bold';
    }
  }

  // Helper to format duration in a human-readable way
  function formatDuration(ms) {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (day > 0) return `${day}d ${hr % 24}h`;
    if (hr > 0) return `${hr}h ${min % 60}m`;
    if (min > 0) return `${min}m ${sec % 60}s`;
    return `${sec}s`;
  }

  // Render participant summary cards
  function renderParticipantSummaries(messages) {
    const container = document.getElementById('participant-summaries');
    if (!container) return;
    container.innerHTML = '';
    const participants = Array.from(new Set(messages.map(m => m.user)));
    const emojiRegex = /\p{Extended_Pictographic}/gu;
    // Prepare participant stats for sorting
    // Use unified function for per-participant word counts (skip emojis)
    const wordCountsByUser = countWordOccurrences(messages, { byParticipant: true, ngram: 1, skipEmojis: true });
    // Use unified function for per-participant emoji counts
    const emojiCountsByUser = countEmojiOccurrences(messages, { byParticipant: true });
    const participantStats = participants.map(user => {
      const userMsgs = messages.filter(m => m.user === user);
      const numMessages = userMsgs.length;
      const avgMsgLen = numMessages > 0 ? (userMsgs.reduce((sum, m) => sum + m.message.length, 0) / numMessages).toFixed(1) : 0;
      // Most used emojis
      const emojiCounts = emojiCountsByUser[user] || {};
      const topEmojis = Object.entries(emojiCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([emoji]) => emoji);
      // Longest message
      let longestMsgText = '';
      let longestMsgLen = 0;
      userMsgs.forEach(m => {
        if (m.message.length > longestMsgLen) {
          longestMsgLen = m.message.length;
          longestMsgText = m.message;
        }
      });
      // Unique words and top words from unified function
      const wordCounts = wordCountsByUser[user] || {};
      const topWords = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([word, count]) => ({ word, count }));
      // Longest gap between messages
      let longestGap = 0;
      let gapStart = null;
      let gapEnd = null;
      let lastMsgTime = null;
      if (userMsgs.length > 0) {
        // Sort messages by timestamp
        const sortedMsgs = userMsgs.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        lastMsgTime = new Date(sortedMsgs[sortedMsgs.length - 1].timestamp);
        for (let i = 1; i < sortedMsgs.length; i++) {
          const prev = new Date(sortedMsgs[i - 1].timestamp);
          const curr = new Date(sortedMsgs[i].timestamp);
          const gap = curr - prev;
          if (gap > longestGap) {
            longestGap = gap;
            gapStart = prev;
            gapEnd = curr;
          }
        }
        // Also consider the gap from their last message to the most recent message in the chat
        const mostRecentMsg = messages.reduce((a, b) => new Date(a.timestamp) > new Date(b.timestamp) ? a : b);
        const gapToNow = new Date(mostRecentMsg.timestamp) - lastMsgTime;
        if (gapToNow > longestGap) {
          longestGap = gapToNow;
          gapStart = lastMsgTime;
          gapEnd = new Date(mostRecentMsg.timestamp);
        }
      }
      return {
        user,
        numMessages,
        avgMsgLen,
        longestMsgLen,
        longestMsgText,
        uniqueWords: Object.keys(wordCounts).length,
        topEmojis,
        emojiCounts, // add this so the card can access counts for tooltips
        topWords, // now contains objects {word, count}
        longestGap,
        gapStart,
        gapEnd,
        lastMsgTime
      };
    });
    // Sort by descending total messages
    participantStats.sort((a, b) => b.numMessages - a.numMessages);
    // Render cards
    participantStats.forEach(stat => {
      const card = document.createElement('div');
      card.className = 'participant-summary-card';
      card.innerHTML = `
        <h4>${stat.user}</h4>
        <div class="stat-row"><span class="stat-label">Total Messages:</span> ${stat.numMessages}</div>
        <div class="stat-row"><span class="stat-label">Average Message Length:</span> ${stat.avgMsgLen}</div>
        <div class="stat-row"><span class="stat-label">Longest Message Length:</span> <span title="${stat.longestMsgText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}">${stat.longestMsgLen}</span></div>
        <div class="stat-row"><span class="stat-label">Unique Words Used:</span> ${stat.uniqueWords}</div>
        <div class="stat-row"><span class="stat-label">Longest Gap:</span> <span title="${stat.gapStart && stat.gapEnd ? `${stat.gapStart.toLocaleString()} → ${stat.gapEnd.toLocaleString()}` : ''}">${stat.longestGap ? formatDuration(stat.longestGap) : '—'}</span></div>
        <div class="stat-row"><span class="stat-label">Last Message:</span> <span title="${stat.lastMsgTime ? stat.lastMsgTime.toLocaleString() : ''}">${stat.lastMsgTime ? stat.lastMsgTime.toLocaleDateString() : '—'}</span></div>
        <div class="stat-row"><span class="stat-label">Top Emojis:</span> <span class="emoji-list">${stat.topEmojis.map(e => `<span title="${stat.emojiCounts[e]} uses">${e}</span>`).join(' ') || '—'}</span></div>
        <div class="stat-row stat-top-words"><span class="stat-label">Top Words:</span></div>
        <div class="top-words-list"><span class="top-words-list">${stat.topWords.map(w => `<span title="${w.count} uses">${w.word}</span>`).join('<br>') || '—'}</span></div>
      `;
      container.appendChild(card);
    });
  }

  function renderWordCloud(messages) {
    const container = document.getElementById('viz-word-cloud');
    container.innerHTML = '';

    // Get word counts (you can customize options)
    const wordCounts = countWordOccurrences(messages, { skipEmojis: true });

    // Convert to array and sort by frequency
    const sortedWords = Object.entries(wordCounts)
      .filter(([word, count]) => word.length > 1 && count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100); // limit to top 100 words for clarity

    const words = sortedWords.map(([word]) => word);
    const counts = sortedWords.map(([, count]) => count);
    const totalMessages = messages.length;
    const ratios = counts.map(count => count / totalMessages);

    // Normalize font sizes between 10 and 50
    const minSize = 10;
    const maxSize = 50;
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    const sizes = counts.map(count =>
      minCount === maxCount
        ? (minSize + maxSize) / 2
        : minSize + (count - minCount) / (maxCount - minCount) * (maxSize - minSize)
    );

    const colors = words.map(() =>
      `hsl(${Math.floor(Math.random() * 360)}, 70%, 45%)`
    );

    // Random layout positions
    const trace = {
      x: words.map(() => Math.random()),
      y: words.map(() => Math.random()),
      mode: 'text',
      type: 'scatter',
      text: words,
      textfont: {
        size: sizes,
        color: colors
      },
      hovertemplate: words.map((w, i) =>
        `<b>${w}</b><br>` +
        `Count: ${counts[i]}<br>` +
        `Appears in ${(ratios[i] * 100).toFixed(1)}% of messages` +
        `<extra></extra>`
      ),
      hoverinfo: 'text'
    };

    const layout = {
      title: { text: 'Word Cloud', font: { size: PLOTLY_TITLE_SIZE } },
      xaxis: { showgrid: false, showticklabels: false, zeroline: false },
      yaxis: { showgrid: false, showticklabels: false, zeroline: false },
      margin: { l: PLOTLY_LEFT_MARGIN, r: 0, t: 80, b: 0 },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      width: container.offsetWidth,
      height: 500
    };

    Plotly.newPlot(container, [trace], layout, { responsive: true });
  }
});

let lastLoadedMessages = null;

// At the end of DOMContentLoaded
window.addEventListener('resize', function() {
  if (lastLoadedMessages) {
    try { renderActivityOverTime(lastLoadedMessages); } catch (err) { showVizError('viz-activity-over-time', err); }
    try { renderMessagesByParticipant(lastLoadedMessages); } catch (err) { showVizError('viz-messages-by-participant', err); }
    try { renderHourlyActivity(lastLoadedMessages); } catch (err) { showVizError('viz-hourly-activity', err); }
    try { renderLongestStreaks(lastLoadedMessages); } catch (err) { showVizError('viz-longest-streaks', err); }
    try { renderWeeklyHeatmap(lastLoadedMessages); } catch (err) { showVizError('viz-weekly-heatmap', err); }
    try { renderEmojiChart(lastLoadedMessages); } catch (err) { showVizError('viz-emojis', err); }
    try { renderResponseTimeHistogram(lastLoadedMessages); } catch (err) { showVizError('viz-response-time', err); }
    try { renderMostUsedWords(lastLoadedMessages); } catch (err) { showVizError('viz-most-used-words', err); }
    try { renderActivityOverTimeGrouped(lastLoadedMessages); } catch (err) { showVizError('viz-activity-over-time-grouped', err); }
    try { renderActivityOverTimeStackedPercent(lastLoadedMessages); } catch (err) { showVizError('viz-activity-over-time-stacked-percent', err); }
    try { renderMessageLengthHistogram(lastLoadedMessages); } catch (err) { showVizError('viz-message-length-histogram', err); }
    try { renderWordCloud(lastLoadedMessages); } catch (err) { showVizError('viz-word-cloud', err); }
  }
}); 
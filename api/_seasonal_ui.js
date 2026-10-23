const html = `
    <section class="dash-section" id="seasonal">
      <h2>Holiday decoration</h2>
      <div class="sh-box">
        <label class="seasonal-switch"><input id="seasonal-enabled" type="checkbox" role="switch" disabled> <strong>Decorative layer on</strong></label>
        <p class="sh-msg">On follows the holiday calendar automatically. Off restores the original page. Photos, prices, content and booking buttons stay the same.</p>
        <p class="sh-msg" id="seasonal-state" role="status">Checking the saved setting…</p>
        <p class="sh-msg" id="seasonal-scope"></p>
        <a class="sh-btn ghost" href="/holiday-preview?theme=halloween" target="_blank" rel="noopener">Preview holiday skins</a>
      </div>
    </section>`;
function client() {
  const control = document.getElementById('seasonal-enabled');
  const message = document.getElementById('seasonal-state');
  let saved = false;
  const say = (text, error = false) => { message.textContent = text; message.classList.toggle('sh-err', error); };
  async function load() {
    try {
      const response = await fetch('/api/seasonal', { cache: 'no-store' });
      if (!response.ok) throw Error('Could not load the saved setting. Refresh to try again.');
      saved = (await response.json()).enabled === true; control.checked = saved; control.disabled = false;
      say(saved ? 'On · the holiday calendar chooses the decoration. Changes reach open pages on their next check, usually within 30 seconds.' : 'Off · the website uses its original appearance.');
    } catch (error) { say(error.message, true); }
  }
  control.addEventListener('change', async () => {
    const requested = control.checked; control.disabled = true; say('Saving…');
    try {
      const response = await fetch('/api/seasonal', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Staff': '1' }, body: JSON.stringify({ enabled: requested }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Could not save. Refresh and try again.');
      saved = result.enabled === true; control.checked = saved;
      say(saved ? 'Saved: On · follows the holiday calendar. Open pages update on their next check, usually within 30 seconds.' : 'Saved: Off · decoration is removed on the next page check, usually within 30 seconds.');
    } catch (error) { control.checked = saved; say(error.message, true); }
    finally { control.disabled = false; }
  });
  load();
}
module.exports = { html, script: '(' + client.toString() + ')();' };

import { loadSettings, saveSettings } from '../shared/storage';
import type { Mode } from '../shared/messages';

async function init(): Promise<void> {
  const settings = await loadSettings();
  const form = document.getElementById('settings') as HTMLFormElement;
  const status = document.getElementById('status');
  if (!form || !status) return;

  (form.elements.namedItem('endpoint') as HTMLInputElement).value = settings.endpoint;
  (form.elements.namedItem('fallbackEndpoint') as HTMLInputElement).value = settings.fallbackEndpoint;
  (form.elements.namedItem('secret') as HTMLInputElement).value = settings.secret;
  (form.elements.namedItem('defaultMode') as HTMLSelectElement).value = settings.defaultMode;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    await saveSettings({
      endpoint: String(fd.get('endpoint') ?? '').trim(),
      fallbackEndpoint: String(fd.get('fallbackEndpoint') ?? '').trim(),
      secret: String(fd.get('secret') ?? '').trim(),
      defaultMode: fd.get('defaultMode') as Mode
    });
    status.textContent = 'Saved.';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  });
}

void init();

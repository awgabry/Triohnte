(() => {
  const existingAudio = document.getElementById('audio-tema');
  const audio = existingAudio || new Audio();
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0.24;

  if (existingAudio) {
    existingAudio.pause();
    existingAudio.innerHTML = '<source src="./Desert.mp3" type="audio/mpeg">';
    existingAudio.src = './Desert.mp3';
    existingAudio.load();
  } else {
    audio.src = './Desert.mp3';
  }

  let button = document.getElementById('triohnte-music-toggle');
  if (!button && !document.querySelector('.music-box')) {
    button = document.createElement('button');
    button.id = 'triohnte-music-toggle';
    button.type = 'button';
    button.textContent = '♫ ATIVAR MÚSICA';
    button.setAttribute('aria-label', 'Ativar música de fundo');
    Object.assign(button.style, {
      position: 'fixed', right: '18px', bottom: '18px', zIndex: '9999',
      padding: '10px 15px', border: '1px solid #9b7541', borderRadius: '3px',
      background: 'rgba(5,5,5,.92)', color: '#d8b574', cursor: 'pointer',
      fontFamily: 'Cinzel, serif', fontSize: '11px', letterSpacing: '1px',
      boxShadow: '0 2px 12px rgba(0,0,0,.55)'
    });
    document.body.appendChild(button);
  }

  const setLabel = (playing) => {
    if (!button) return;
    button.textContent = playing ? '♫ PAUSAR MÚSICA' : '♫ ATIVAR MÚSICA';
    button.setAttribute('aria-label', playing ? 'Pausar música de fundo' : 'Ativar música de fundo');
  };

  if (button) {
    button.addEventListener('click', async () => {
      if (audio.paused) {
        try { await audio.play(); setLabel(true); }
        catch (error) { setLabel(false); }
      } else {
        audio.pause();
        setLabel(false);
      }
    });
  }

  audio.play().then(() => setLabel(true)).catch(() => setLabel(false));
})();
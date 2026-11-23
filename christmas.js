/* Triohnte — ativa a decoração sazonal sem alterar a estrutura das páginas. */
(() => {
  if (document.getElementById('triohnte-christmas-garland')) return;
  const garland = document.createElement('div');
  garland.id = 'triohnte-christmas-garland';
  garland.setAttribute('aria-hidden', 'true');
  const snow = document.createElement('div');
  snow.id = 'triohnte-christmas-snow';
  snow.setAttribute('aria-hidden', 'true');
  document.body.append(garland, snow);
})();
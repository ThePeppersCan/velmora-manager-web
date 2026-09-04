/* Central news stays inside the existing fixture card. No career state is saved here. */
(() => {
  'use strict';
  const INTERVAL = 8000;
  const scenes = {
    training: ['training-dusk', 'training-golden', 'training-overcast', 'training-day'],
    press: ['press-crestline', 'press-foundry', 'press-matchsphere', 'press-orbis', 'press-fairmont']
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function sceneFor(story) {
    const category = String(story.category || '').toUpperCase();
    const text = `${category} ${story.title || ''}`;
    const press = /MANAGER|PRESS|BOARD|MEDIA|INTERVIEW|CONTRACT|RIVALRY/.test(category);
    const training = !press && /TRAINING|ACADEMY|DEVELOPMENT|BREAKOUT|PLAYER|INJUR|RECOVER|SIGN|TRANSFER|LOAN/i.test(text);
    const group = training ? 'training' : 'press';
    let seed = 0;
    for (const c of String(story.id || story.title || 'news')) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
    return {group, src: `assets/central-news/scenes/${scenes[group][seed % scenes[group].length]}.png`};
  }
  function fixtureIsDue(today, fixture) {
    if (!fixture || fixture.played || !today || !fixture.date) return false;
    const days = (Date.parse(`${fixture.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
    return days === 0 || days === 1;
  }
  let controller = null;
  function create(root) {
    const host = document.createElement('section');
    host.className = 'central-news-feature';
    host.hidden = true;
    host.setAttribute('aria-label', 'Current career news');
    host.setAttribute('aria-roledescription', 'carousel');
    host.innerHTML = `
      <header class="cn-header"><div><span class="cn-eyebrow">AROUND THE GROUNDS</span><h2>THE NEWSROOM</h2></div><span class="cn-date"></span></header>
      <article class="cn-story" aria-live="off" aria-roledescription="slide">
        <img class="cn-scene" alt="" aria-hidden="true"><div class="cn-shade" aria-hidden="true"></div>
        <div class="cn-copy"><div class="cn-story-meta"><span class="cn-category"></span><span class="cn-story-date"></span></div><h3 class="cn-title"></h3><p class="cn-summary"></p><span class="cn-source"></span></div>
        <div class="cn-cast"></div>
      </article>
      <footer class="cn-footer"><div class="cn-controls"><button type="button" data-cn="previous" aria-label="Previous story">‹</button><span class="cn-count" aria-label="Story position"></span><button type="button" data-cn="next" aria-label="Next story">›</button><button type="button" data-cn="pause" aria-label="Pause news rotation" aria-pressed="false">Ⅱ</button></div><div class="cn-dots" aria-label="Choose a story"></div><button class="cn-read" type="button" data-cn="read">READ STORY <span aria-hidden="true">→</span></button></footer>`;
    root.appendChild(host);
    const find = selector => host.querySelector(selector);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let items = [], index = 0, timer = null, active = false, newsMode = false;
    let paused = motion.matches, hovered = false, focused = false, options = {};
    function stop() { if (timer !== null) clearTimeout(timer); timer = null; }
    function controls() {
      const single = items.length < 2;
      find('[data-cn="previous"]').disabled = single;
      find('[data-cn="next"]').disabled = single;
      const pause = find('[data-cn="pause"]');
      pause.disabled = single;
      pause.textContent = paused ? '▶' : 'Ⅱ';
      pause.setAttribute('aria-label', paused ? 'Resume news rotation' : 'Pause news rotation');
      pause.setAttribute('aria-pressed', String(paused));
    }
    function schedule() {
      stop();
      if (!active || !newsMode || paused || hovered || focused || document.hidden || items.length < 2) return;
      timer = setTimeout(() => {
        timer = null;
        if (!root.isConnected) return;
        if (!options.isBlocked?.()) show(index + 1, false);
        else schedule();
      }, INTERVAL);
    }
    function portrait(actor) {
      const initials = actor.name.split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0]).join('');
      const visual = actor.render ? actor.render() : actor.src ? `<img class="cn-person-sprite" src="${escape(actor.src)}" data-fallback="${escape(actor.fallback || '')}" alt="${escape(actor.name)}">` : '';
      const kind = actor.kind === 'manager' ? ' is-manager' : '';
      return `<figure class="cn-person${kind}${visual ? '' : ' is-unavailable'}" data-person-id="${escape(actor.id)}"><div class="cn-person-art">${visual}<span class="cn-person-initials" aria-hidden="true">${escape(initials)}</span></div><figcaption>${escape(actor.name)}</figcaption></figure>`;
    }
    function show(next, manual = false) {
      if (!items.length) return;
      index = (next + items.length) % items.length;
      const item = items[index], scene = sceneFor(item);
      const article = find('.cn-story');
      article.setAttribute('aria-live', manual ? 'polite' : 'off');
      article.setAttribute('aria-label', `Story ${index + 1} of ${items.length}`);
      host.dataset.storyId = item.id;
      host.dataset.scene = scene.group;
      const background = find('.cn-scene');
      background.hidden = false;
      background.onerror = () => { background.hidden = true; };
      background.src = scene.src;
      find('.cn-category').textContent = item.category || 'CLUB NEWS';
      find('.cn-story-date').textContent = item.time || '';
      find('.cn-title').textContent = item.title;
      find('.cn-summary').textContent = item.summary || '';
      find('.cn-source').textContent = item.source || '';
      const cast = find('.cn-cast'), actors = item.actors || [];
      cast.dataset.count = String(actors.length);
      cast.innerHTML = actors.length ? actors.map(portrait).join('') : `<div class="cn-club-focus"><div>${item.badgeHTML || ''}</div><span>IN FOCUS</span><strong>${escape(item.clubName || 'THE WORLD GAME')}</strong></div>`;
      cast.querySelectorAll('.cn-person-sprite').forEach(img => {
        img.onerror = () => {
          const fallback = img.dataset.fallback;
          if (fallback) { img.dataset.fallback = ''; img.src = fallback; }
          else { img.hidden = true; img.closest('.cn-person').classList.add('is-unavailable'); }
        };
      });
      options.hydrate?.(cast);
      find('.cn-count').textContent = `${String(index + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
      find('.cn-dots').querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-current', String(i === index)));
      controls();
      if (!motion.matches && typeof article.animate === 'function') article.animate([{opacity: .6}, {opacity: 1}], {duration: 260});
      schedule();
    }
    host.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || !host.contains(button)) return;
      const action = button.dataset.cn;
      if (action === 'previous') show(index - 1, true);
      if (action === 'next') show(index + 1, true);
      if (action === 'pause') { paused = !paused; controls(); schedule(); }
      if (action === 'read') { stop(); options.onOpen?.(items[index]?.id); schedule(); }
      if (button.dataset.cnIndex !== undefined) show(Number(button.dataset.cnIndex), true);
    });
    host.addEventListener('mouseenter', () => { hovered = true; stop(); });
    host.addEventListener('mouseleave', () => { hovered = false; schedule(); });
    host.addEventListener('focusin', () => { focused = true; stop(); });
    host.addEventListener('focusout', event => { focused = host.contains(event.relatedTarget); schedule(); });
    document.addEventListener('visibilitychange', schedule);
    motion.addEventListener?.('change', event => { if (event.matches) paused = true; controls(); schedule(); });
    return {
      render(nextOptions) {
        options = nextOptions;
        stop();
        newsMode = !options.fixtureMode;
        root.classList.toggle('is-news-mode', newsMode);
        root.setAttribute('aria-label', newsMode ? 'Current career news' : 'Next fixture team sheets');
        const fixtureFooter = root.querySelector(':scope > .central-fixture-footer');
        if (fixtureFooter) { fixtureFooter.hidden = newsMode; fixtureFooter.setAttribute('aria-hidden', String(newsMode)); }
        host.hidden = !newsMode;
        if (!newsMode) { items = []; return; }
        const previousId = items[index]?.id;
        items = options.items || [];
        index = Math.max(0, items.findIndex(item => item.id === previousId));
        find('.cn-date').textContent = options.dateLabel || '';
        find('.cn-dots').innerHTML = items.map((item, i) => `<button type="button" data-cn-index="${i}" aria-label="Story ${i + 1}: ${escape(item.title)}" aria-current="false"><span></span></button>`).join('');
        show(index);
      },
      setActive(value) { active = !!value; schedule(); },
      snapshot() { return {mode: newsMode ? 'news' : 'fixture', storyId: items[index]?.id || null, count: items.length, paused, timerRunning: timer !== null}; }
    };
  }
  window.VELMORA_CENTRAL_NEWS = {
    fixtureIsDue, sceneFor,
    render(options) {
      const root = document.querySelector('#screenCentral .central-match-hero');
      if (!root) return;
      if (!controller) controller = create(root);
      controller.render(options);
      controller.setActive(document.querySelector('#screenCentral')?.classList.contains('is-active'));
    },
    setScreenActive(active) { controller?.setActive(active); },
    snapshot() { return controller?.snapshot() || null; }
  };
})();

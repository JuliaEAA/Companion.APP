(function(){
  const gallery = document.querySelector('.loop-carousel');
  if (!gallery) return;
  const viewport = gallery.querySelector('.lc-viewport');
  const track = gallery.querySelector('.lc-track');
  const prevBtn = gallery.querySelector('.lc-prev');
  const nextBtn = gallery.querySelector('.lc-next');
  const dotsWrap = gallery.querySelector('.lc-dots');
  let originals = Array.from(track.querySelectorAll('.lc-item'));
  if (originals.length === 0) return;

  // Clone for looping
  const n = originals.length;
  // create clones: prepend last n, append first n
  const prependClones = originals.map(node => node.cloneNode(true)).reverse();
  prependClones.forEach(c => track.insertBefore(c, track.firstChild));
  const appendClones = originals.map(node => node.cloneNode(true));
  appendClones.forEach(c => track.appendChild(c));

  let items = Array.from(track.children); // now 3n items

  let itemWidth = 0; // will compute
  let gap = 12; // CSS gap fallback
  let offset = 0; // current translateX
  const ease = '320ms cubic-bezier(.22,.9,.2,1)';

  function updateSizes() {
    // compute item width including gap
    const rect = items[0].getBoundingClientRect();
    itemWidth = rect.width;
    // compute gap from computed style if available
    const style = getComputedStyle(track);
    const g = parseFloat(style.columnGap || style.gap || style.gridGap || '0');
    gap = isNaN(g) ? gap : g;
  }

  function applyOffset(x, animate = false) {
    if (animate) track.style.transition = `transform ${ease}`;
    else track.style.transition = 'none';
    track.style.transform = `translateX(${x}px)`;
  }

  function initialPosition() {
    updateSizes();
    // after prepending n clones, the first original is at index n
    offset = - (n * (itemWidth + gap));
    applyOffset(offset, false);
    // build dots and set active
    buildDots();
    setActiveDotByOffset();
  }

  // --- pagination dots helpers ---
  function buildDots(){
    if (!dotsWrap) return;
    dotsWrap.innerHTML = '';
    for(let i=0;i<n;i++){
      const b = document.createElement('button');
      b.className = 'lc-dot';
      b.type = 'button';
      b.setAttribute('aria-label', `Go to slide ${i+1}`);
      b.dataset.index = String(i);
      b.addEventListener('click', ()=> jumpToOriginal(i));
      dotsWrap.appendChild(b);
    }
  }

  function setActiveDotByOffset(){
    if (!dotsWrap) return;
    const step = itemWidth + gap;
    const floatIndex = -offset / step;
    let nearest = Math.round(floatIndex);
    // normalize into originals block
    const originalsStart = n;
    const originalsEnd = n + n - 1;
    let normalized = nearest;
    if (nearest < originalsStart) normalized = nearest + n;
    else if (nearest > originalsEnd) normalized = nearest - n;
    let originalIndex = (normalized - originalsStart) % n;
    if (originalIndex < 0) originalIndex += n;
    // update classes
    Array.from(dotsWrap.children).forEach((btn, idx)=> btn.classList.toggle('active', idx === originalIndex));
    // Also mark the centered item with a class for visual depth effects
    try {
      if (items && items.length) {
        const idx = clampIndex(nearest);
        items.forEach((it, i) => it.classList.toggle('is-active', i === idx));
      }
    } catch (err) {
      // non-fatal
      // console.warn('setActiveDotByOffset: could not set active item', err);
    }
  }

  function jumpToOriginal(index){
    // animate to the original slide index within the originals block
    updateSizes();
    const step = itemWidth + gap;
    const originalsStart = n;
    const target = - (originalsStart + index) * step;
    offset = target;
    applyOffset(offset, true);
    // ensure active dot set after animation
    setTimeout(()=> setActiveDotByOffset(), 360);
  }

  // pointer dragging
  let isDown = false;
  let startX = 0;
  let startOffset = 0;
  let positions = [];

  // Attach pointer listeners to the viewport so finger drags anywhere inside the viewport work reliably
  viewport.addEventListener('pointerdown', (e) => {
    isDown = true;
    startX = e.clientX;
    startOffset = offset;
    positions = [{ x: startX, t: Date.now(), pointerType: e.pointerType }];
    try { viewport.setPointerCapture(e.pointerId); } catch (err) {}
    track.style.transition = 'none';
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!isDown) return;
    const x = e.clientX;
    positions.push({ x, t: Date.now(), pointerType: e.pointerType });
    if (positions.length > 12) positions.shift();
    const dx = x - startX;
    offset = startOffset + dx;
    applyOffset(offset, false);
  });

  function clampIndex(i){
    // index within 0..(3n-1)
    const L = items.length;
    return ((i % L) + L) % L;
  }

  function snapToNearest() {
    // compute float index from offset (how many item widths from start)
    const step = itemWidth + gap;
    const floatIndex = -offset / step;
    let nearest = Math.round(floatIndex);
    // animate to nearest
    const target = -nearest * step;
    offset = target;
    applyOffset(offset, true);

    // after animation, if nearest is in clones zone, jump to equivalent original without animation
    const total = items.length; // 3n
    const originalsStart = n;
    const originalsEnd = n + n - 1;
    const animationDuration = 340;
    setTimeout(() => {
      // normalize nearest into originals block
      let normalized = nearest;
      if (nearest < originalsStart) normalized = nearest + n;
      else if (nearest > originalsEnd) normalized = nearest - n;
      const desired = - (normalized * step);
      if (Math.abs(desired - offset) > 0.5) {
        // jump silently
        offset = desired;
        applyOffset(offset, false);
      }
      // update dots after any normalization
      setActiveDotByOffset();
    }, animationDuration + 10);
  }

  viewport.addEventListener('pointerup', (e) => {
    if (!isDown) return;
    isDown = false;
    const endX = e.clientX;
    positions.push({ x: endX, t: Date.now() });
    const recent = positions[positions.length-1];
    const first = positions[0];
    const dt = Math.max(1, recent.t - first.t);
    const velocity = (recent.x - first.x) / dt; // px per ms
    const dxTotal = endX - startX;
    // adapt thresholds for touch vs mouse
    const isTouch = recent && recent.pointerType === 'touch';
    const vThreshold = isTouch ? 0.35 : 0.5; // px/ms
    const dThreshold = isTouch ? 30 : 40; // px

    // if flick velocity or distance then move one item in direction
    if (velocity < -vThreshold || dxTotal < -dThreshold) {
      // next
      slideBy(1);
      return;
    }
    if (velocity > vThreshold || dxTotal > dThreshold) {
      slideBy(-1);
      return;
    }

    // otherwise snap to nearest
    snapToNearest();
  });

  viewport.addEventListener('pointercancel', () => { isDown = false; });

  function slideBy(delta) {
    const step = itemWidth + gap;
    // compute current float index
    const floatIndex = -offset / step;
    const targetIndex = Math.round(floatIndex) + delta;
    offset = - targetIndex * step;
    applyOffset(offset, true);
    // after animation, normalize
    setTimeout(() => {
      const originalsStart = n;
      const originalsEnd = n + n - 1;
      let normalized = targetIndex;
      if (targetIndex < originalsStart) normalized = targetIndex + n;
      else if (targetIndex > originalsEnd) normalized = targetIndex - n;
      const desired = -normalized * step;
      if (Math.abs(desired - offset) > 0.5) {
        offset = desired;
        applyOffset(offset, false);
      }
      // update dots after sliding
      setActiveDotByOffset();
    }, 360);
  }

  // prev/next buttons
  if (prevBtn) prevBtn.addEventListener('click', () => slideBy(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => slideBy(1));

  // resize handling
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { updateSizes(); initialPosition(); }, 120); });

  // init after images loaded
  const imgs = track.querySelectorAll('img');
  let imgsLeft = imgs.length;
  imgs.forEach(i=>{
    if (i.complete) imgsLeft--;
    else i.addEventListener('load', ()=>{ imgsLeft--; if (imgsLeft===0) initialPosition(); });
  });
  if (imgsLeft===0) initialPosition();

})();

// -----------------------
// Modal behavior: show access-required popup when discounts area is clicked
// -----------------------
(function(){
  const modal = document.getElementById('discountsModal');
  if (!modal) return;

  // Helper to set visible state using aria-hidden for accessibility
  function showModal(){
    modal.setAttribute('aria-hidden', 'false');
    // prevent background scroll while modal is open
    document.documentElement.style.overflow = 'hidden';
    // focus first focusable control for keyboard users
    const focusTarget = modal.querySelector('.modal-login') || modal.querySelector('.modal-close');
    if (focusTarget) focusTarget.focus();
  }
  function hideModal(){
    modal.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }

  // Show modal when user clicks inside main content (covers the discounts area)
  const mainEl = document.querySelector('main') || document.body;
  mainEl.addEventListener('click', function onMainClick(e){
    // if clicking inside the modal itself, ignore
    if (e.target.closest('#discountsModal')) return;
    // show the modal on any click inside main
    showModal();
  });

  // Close handlers
  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) closeBtn.addEventListener('click', hideModal);

  const loginBtn = modal.querySelector('.modal-login');
  if (loginBtn) loginBtn.addEventListener('click', function(){
    // navigate to a login page; if you have a different path change this
    window.location.href = loginBtn.getAttribute('href') || 'login.html';
  });

  // clicking the overlay outside the modal content should close
  modal.addEventListener('click', function(e){ if (e.target === modal) hideModal(); });

  // escape key closes
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') hideModal(); });

})();

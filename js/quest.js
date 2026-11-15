/* 冒險關卡 HUD：左上角顯示目前關卡，右上角經驗值條＝簡報進度
 * 關卡由 <section data-stage="編號|名稱"> 標在每關的第一頁，之後的頁面沿用 */
(function () {
  if (/print-pdf/.test(location.search)) return;
  var hud = document.createElement('div');
  hud.id = 'hud';
  hud.innerHTML = '<span class="stage"><span class="no"></span><span class="name"></span></span>' +
    '<span class="xp">EXP <span class="bar"><i></i></span> <span class="cnt"></span></span>';
  document.body.appendChild(hud);
  var toast = document.createElement('div');
  toast.id = 'stage-toast';
  toast.innerHTML = '<div class="no"></div><div class="name"></div>';
  document.body.appendChild(toast);

  var slides = [].slice.call(document.querySelectorAll('.reveal .slides > section'));
  var shown = {};

  function stageOf(i) {
    for (var k = i; k >= 0; k--) {
      var s = slides[k] && slides[k].getAttribute('data-stage');
      if (s) { var p = s.split('|'); return { no: p[0], name: p[1] || '' }; }
    }
    return null;
  }
  function label(no) { return /^\d+$/.test(no) ? 'STAGE ' + no + ' / 5' : no; }

  function update(e) {
    var i = Reveal.getIndices().h;
    var st = stageOf(i);
    hud.classList.toggle('hide', !st || i === 0);
    if (st) {
      hud.querySelector('.stage .no').textContent = label(st.no);
      hud.querySelector('.stage .name').textContent = st.name;
    }
    hud.querySelector('.bar i').style.width = ((i + 1) / slides.length * 100) + '%';
    hud.querySelector('.cnt').textContent = (i + 1) + '/' + slides.length;

    // 往前翻到某關的第一頁時，跳出一次「STAGE n」提示
    var first = slides[i] && slides[i].getAttribute('data-stage');
    var forward = !e || e.previousSlide == null || slides.indexOf(e.previousSlide) < i;
    if (first && i > 0 && forward && !shown[i] && window.gsap) {
      shown[i] = true;
      toast.querySelector('.no').textContent = /^\d+$/.test(st.no) ? 'STAGE ' + st.no : st.no;
      toast.querySelector('.name').textContent = st.name;
      gsap.killTweensOf(toast);
      gsap.timeline()
        .fromTo(toast, { autoAlpha: 0, scale: .6 }, { autoAlpha: 1, scale: 1, duration: .35, ease: 'back.out(2.2)' })
        .to(toast, { autoAlpha: 0, scale: .9, duration: .3, delay: .9 });
    }
  }
  var init = function () { update(null); Reveal.on('slidechanged', update); };
  Reveal.isReady() ? init() : Reveal.on('ready', init);
})();

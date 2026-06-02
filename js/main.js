/**
 * "容载万方：肇庆博物馆藏砚沉吟" 拼字游戏主逻辑
 * 状态持久化 · SortableJS 拖拽 · 自动检测 · 多重渐进提示
 * 灯泡回看 · 跳过 · 前后导航不丢状态 · 散字重排/重新挑战双模式
 * Web Audio 音效
 */
(function () {
  'use strict';

  // ---------- DOM Elements ----------
  const pageIntro = document.getElementById('page-intro');
  const pageGame = document.getElementById('page-game');
  const btnEnter = document.getElementById('btn-enter');
  const soundToggle = document.getElementById('sound-toggle');
  const musicToggle = document.getElementById('music-toggle');
  const tutorialBtn = document.getElementById('tutorial-btn');

  const progressCurrent = document.getElementById('progress-current');
  const navPrev = document.getElementById('nav-prev');
  const navNext = document.getElementById('nav-next');
  const inkstoneImg = document.getElementById('inkstone-img');
  const inkstoneCard = document.getElementById('inkstone-card');
  const appearanceText = document.getElementById('appearance-text');
  const hintGuideText = document.getElementById('hint-guide-text');
  const hintBulbs = document.getElementById('hint-bulbs');
  const wordBlocks = document.getElementById('word-blocks');
  const btnCheck = document.getElementById('btn-check');
  const btnReset = document.getElementById('btn-reset');
  const btnSkip = document.getElementById('btn-skip');
  const btnNext = document.getElementById('btn-next');
  const cultureCard = document.getElementById('culture-card');
  const cultureName = document.getElementById('culture-name');
  const cultureMeta = document.getElementById('culture-meta');
  const cultureDesc = document.getElementById('culture-desc');

  const bulbEls = hintBulbs.querySelectorAll('.hint-bulb');

  // ---------- Per-Inkstone State ----------
  // { [index]: { solved: bool, revealedHints: [], blocksOrder: [] } }
  const inkstoneStates = {};
  let currentIndex = 0;
  let sortableInstance = null;
  let isSolved = false;
  let revealedHints = [];

  // ---------- Image Preloader ----------
  function preloadImages() {
    const urls = [];

    // Game page background
    urls.push('image/次界面背景.png');

    // All 12 inkstone images
    inkstones.forEach(function (stone) {
      urls.push(stone.imageUrl);
    });

    // Create Image objects to trigger browser cache
    urls.forEach(function (url) {
      var img = new Image();
      img.src = url;
    });
  }

  // ---------- Init ----------
  function init() {
    AudioEngine.init();

    // Preload all game images while user is on the intro page
    preloadImages();

    soundToggle.addEventListener('click', () => {
      AudioEngine.toggle();
    });

    musicToggle.addEventListener('click', () => {
      AudioEngine.toggleBgm();
    });

    tutorialBtn.addEventListener('click', () => {
      AudioEngine.playButton();
      showTutorial();
    });

    btnEnter.addEventListener('click', () => {
      AudioEngine.playButton();
      showTutorial(() => {
        switchToGamePage();
      });
    });

    btnCheck.addEventListener('click', handleCheck);
    btnReset.addEventListener('click', handleReset);
    btnSkip.addEventListener('click', handleSkip);
    btnNext.addEventListener('click', handleNext);

    navPrev.addEventListener('click', handlePrev);
    navNext.addEventListener('click', handleNext);

    inkstoneImg.addEventListener('click', showNextHint);

    hintBulbs.addEventListener('click', (e) => {
      const bulb = e.target.closest('.hint-bulb');
      if (!bulb) return;
      const hintIdx = parseInt(bulb.dataset.hint);
      if (revealedHints.includes(hintIdx)) {
        reviewHint(hintIdx);
      }
    });
  }

  // ---------- Tutorial ----------
  function showTutorial(onConfirm) {
    Swal.fire({
      title: '📜 游玩方法',
      html: `
        <div style="text-align:left;font-size:0.9rem;line-height:2;padding:0.25rem 0.5rem;">
          <p>🖼️ <b>观察砚台</b>：每方端砚展示图</p>
          <p>🧩 <b>移字归序</b>：拖拽字块重新排列，还原砚台全名</p>
          <p>💡 <b>三重提示</b>：轻触砚台图片，可逐层解锁提示（共3层）</p>
          <p>✅ <b>叩名定字</b>：排列正确即解锁砚台品鉴</p>
          <p>⏭️ <b>览下一方</b>：通过后可继续探索下一方端砚</p>
          <p style="margin-top:0.5rem;color:#8b6f47;text-align:center;">
            共12方端砚珍品，尽览<b>"容载万方"</b>！
          </p>
        </div>
      `,
      confirmButtonText: onConfirm ? '开始游戏' : '知道了',
      showClass: { popup: 'animate__animated animate__fadeIn' },
      customClass: {
        popup: 'swal2-popup swal2-tutorial',
        title: 'swal2-title',
        confirmButton: 'swal2-confirm'
      }
    }).then((result) => {
      if (result.isConfirmed && onConfirm) {
        onConfirm();
      }
    });
  }

  // ---------- Page Switching ----------
  function switchToGamePage() {
    pageIntro.classList.add('page-transition-out');
    setTimeout(() => {
      pageIntro.style.display = 'none';
      pageIntro.classList.remove('page-transition-out');
      pageGame.style.display = 'flex';
      pageGame.classList.add('page-transition-in');
      loadInkstone(0);
      setTimeout(() => pageGame.classList.remove('page-transition-in'), 350);
    }, 300);
  }

  // ---------- Load Inkstone (with state restoration) ----------
  function loadInkstone(index) {
    if (index >= inkstones.length) {
      handleAllComplete();
      return;
    }

    currentIndex = index;
    const data = inkstones[index];
    const saved = inkstoneStates[index];

    // Update progress and nav immediately
    progressCurrent.textContent = index + 1;
    updateNavArrows();

    // ---- Fade out current content ----
    wordBlocks.style.opacity = '0';
    wordBlocks.style.transform = 'translateY(6px)';
    hintBulbs.style.opacity = '0';
    appearanceText.style.opacity = '0';
    hintGuideText.style.opacity = '0';

    // Crossfade image (scale + opacity)
    inkstoneImg.style.opacity = '0';
    inkstoneImg.style.transform = 'scale(0.96)';

    setTimeout(() => {
      // Swap image
      inkstoneImg.src = data.imageUrl;
      inkstoneImg.alt = data.fullName;

      // Fade image in
      requestAnimationFrame(() => {
        inkstoneImg.style.opacity = '1';
        inkstoneImg.style.transform = 'scale(1)';
      });

      // Update appearance text
      appearanceText.textContent = data.appearance;
      appearanceText.style.opacity = '1';
      hintGuideText.style.opacity = '1';

      // Check if this inkstone was previously solved
      if (saved && saved.solved) {
        // Restore solved state
        isSolved = true;
        revealedHints = [...(saved.revealedHints || [])];

        // Restore word blocks in correct order
        restoreWordBlocks(data.nameChars);

        // Restore UI state
        restoreSolvedUI(data);
      } else if (saved && !saved.solved) {
        // Restore partial progress (hints + block order)
        isSolved = false;
        revealedHints = [...(saved.revealedHints || [])];

        if (saved.blocksOrder && saved.blocksOrder.length) {
          restoreBlockOrder(saved.blocksOrder);
        } else {
          renderWordBlocks(data.nameChars);
        }

        restoreUnsolvedUI();
        initSortable();
      } else {
        // Fresh state
        isSolved = false;
        revealedHints = [];

        resetUnsolvedUI();
        renderWordBlocks(data.nameChars);
        initSortable();
      }

      // ---- Fade in new puzzle content ----
      setTimeout(() => {
        wordBlocks.style.opacity = '1';
        wordBlocks.style.transform = '';
        hintBulbs.style.opacity = '1';
        wordBlocks.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    }, 200);
  }

  // ---------- Save / Restore State ----------
  function saveCurrentState() {
    const blocks = wordBlocks.querySelectorAll('.word-block');
    const blocksOrder = Array.from(blocks).map(b => b.textContent);
    inkstoneStates[currentIndex] = {
      solved: isSolved,
      revealedHints: [...revealedHints],
      blocksOrder: blocksOrder
    };
  }

  function restoreWordBlocks(correctChars) {
    // Show blocks in correct order (locked)
    wordBlocks.innerHTML = '';
    correctChars.forEach((char, idx) => {
      const block = document.createElement('div');
      block.className = 'word-block';
      block.textContent = char;
      block.dataset.char = char;
      block.dataset.index = idx;
      wordBlocks.appendChild(block);
    });
    wordBlocks.classList.add('solved');
  }

  function restoreBlockOrder(order) {
    wordBlocks.innerHTML = '';
    order.forEach((char, idx) => {
      const block = document.createElement('div');
      block.className = 'word-block';
      block.textContent = char;
      block.dataset.char = char;
      block.dataset.index = idx;
      wordBlocks.appendChild(block);
    });
    wordBlocks.classList.remove('solved');
  }

  function restoreSolvedUI(data) {
    // Remove unsolved states
    wordBlocks.classList.remove('success-flash');
    btnCheck.classList.remove('btn-check--glow');

    // Apply solved UI
    inkstoneCard.classList.add('success-glow');
    wordBlocks.classList.add('solved');
    btnCheck.classList.add('btn-check--glow');
    btnCheck.textContent = '✓ 名已正';
    btnCheck.disabled = true;
    btnReset.textContent = '重新挑战';
    btnReset.disabled = false;
    btnSkip.style.display = 'none';

    // Restore bulbs
    resetBulbs();
    revealedHints.forEach(hi => {
      const bulb = hintBulbs.querySelector(`[data-hint="${hi}"]`);
      if (bulb) bulb.classList.add('hint-bulb--lit');
    });
    updateHintGuideText();

    // Expand culture card
    expandCultureCard(data);

    // Show next button
    if (currentIndex === inkstones.length - 1) {
      btnNext.textContent = '🏆 终章·一览众砚';
    } else {
      btnNext.textContent = '览下一方 →';
    }
    btnNext.style.display = 'inline-flex';

    // Destroy Sortable (blocks are locked)
    if (sortableInstance) {
      sortableInstance.destroy();
      sortableInstance = null;
    }
  }

  function restoreUnsolvedUI() {
    inkstoneCard.classList.remove('success-glow');
    btnCheck.classList.remove('btn-check--glow');
    wordBlocks.classList.remove('success-flash', 'solved');
    collapseCultureCard();
    btnNext.style.display = 'none';
    btnCheck.disabled = false;
    btnCheck.textContent = '叩名定字';
    btnReset.textContent = '散字重排';
    btnReset.disabled = false;
    btnSkip.style.display = '';

    resetBulbs();
    revealedHints.forEach(hi => {
      const bulb = hintBulbs.querySelector(`[data-hint="${hi}"]`);
      if (bulb) bulb.classList.add('hint-bulb--lit');
    });
    updateHintGuideText();
  }

  function resetUnsolvedUI() {
    inkstoneCard.classList.remove('success-glow');
    btnCheck.classList.remove('btn-check--glow');
    wordBlocks.classList.remove('success-flash', 'solved');
    collapseCultureCard();
    btnNext.style.display = 'none';
    btnCheck.disabled = false;
    btnCheck.textContent = '叩名定字';
    btnReset.textContent = '散字重排';
    btnReset.disabled = false;
    btnSkip.style.display = '';

    resetBulbs();
    hintGuideText.textContent = '💡 轻触砚图，逐层解锁三重提示';
  }

  // ---------- Word Blocks ----------
  function renderWordBlocks(chars) {
    const shuffled = [...chars];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    wordBlocks.innerHTML = '';
    shuffled.forEach((char, idx) => {
      const block = document.createElement('div');
      block.className = 'word-block';
      block.textContent = char;
      block.dataset.char = char;
      block.dataset.index = idx;
      wordBlocks.appendChild(block);
    });
  }

  function getCurrentOrder() {
    const blocks = wordBlocks.querySelectorAll('.word-block');
    return Array.from(blocks).map(b => b.textContent).join('');
  }

  // ---------- SortableJS with Auto-Detect ----------
  function initSortable() {
    // Destroy previous instance to avoid stale listeners
    if (sortableInstance) {
      sortableInstance.destroy();
      sortableInstance = null;
    }

    sortableInstance = new Sortable(wordBlocks, {
      animation: 150,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      forceFallback: true,
      touchStartThreshold: 0,

      onStart: function () {
        AudioEngine.playDragStart();
        // Save block order on drag start for state persistence
        saveCurrentState();
      },

      onEnd: function () {
        AudioEngine.playPlace();
        // Save after each move
        saveCurrentState();

        if (!isSolved) {
          clearTimeout(sortableInstance._autoCheckTimer);
          sortableInstance._autoCheckTimer = setTimeout(() => {
            autoCheck();
          }, 200);
        }
      }
    });
  }

  function autoCheck() {
    if (isSolved) return;
    const data = inkstones[currentIndex];
    const currentOrder = getCurrentOrder();
    const correctOrder = data.nameChars.join('');
    if (currentOrder === correctOrder) {
      onCorrectAnswer(data);
    }
  }

  // ---------- Manual Check ----------
  function handleCheck() {
    AudioEngine.playButton();
    if (isSolved) return;

    const data = inkstones[currentIndex];
    const currentOrder = getCurrentOrder();
    const correctOrder = data.nameChars.join('');

    if (currentOrder === correctOrder) {
      onCorrectAnswer(data);
    } else {
      AudioEngine.playError();
      Swal.fire({
        title: '尚差毫厘',
        text: '字序未合，请再运慧心调之。',
        icon: 'info',
        confirmButtonText: '再试',
        customClass: {
          popup: 'swal2-popup',
          title: 'swal2-title',
          confirmButton: 'swal2-confirm'
        }
      });
    }
  }

  // ---------- Correct Answer ----------
  function onCorrectAnswer(data) {
    if (isSolved) return;
    isSolved = true;

    AudioEngine.playSuccess();

    // Lock word blocks
    wordBlocks.classList.add('solved');

    // Flash animation
    wordBlocks.classList.add('success-flash');
    setTimeout(() => wordBlocks.classList.remove('success-flash'), 850);

    // Glow on check button
    btnCheck.classList.add('btn-check--glow');
    btnCheck.textContent = '✓ 名已正';

    // Glow on inkstone card
    inkstoneCard.classList.add('success-glow');

    // Update button states
    btnCheck.disabled = true;
    btnReset.textContent = '重新挑战';
    btnReset.disabled = false;   // enabled — now acts as "re-challenge"
    btnSkip.style.display = 'none';

    // Destroy Sortable
    if (sortableInstance) {
      sortableInstance.destroy();
      sortableInstance = null;
    }

    // Save state
    saveCurrentState();

    // Expand culture card
    setTimeout(() => {
      expandCultureCard(data);

      if (currentIndex === inkstones.length - 1) {
        btnNext.textContent = '🏆 终章·一览众砚';
      } else {
        btnNext.textContent = '览下一方 →';
      }
      btnNext.style.display = 'inline-flex';
      btnNext.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }

  // ---------- Skip ----------
  function handleSkip() {
    AudioEngine.playButton();
    const data = inkstones[currentIndex];

    Swal.fire({
      title: '略过拼字',
      text: '将直接展示此砚的文化品鉴，确定略过吗？',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '略过',
      cancelButtonText: '继续拼字',
      customClass: {
        popup: 'swal2-popup',
        title: 'swal2-title',
        confirmButton: 'swal2-confirm'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        onCorrectAnswer(data);
      }
    });
  }

  // ---------- Reset (dual-mode: shuffle / re-challenge) ----------
  function handleReset() {
    AudioEngine.playButton();
    const data = inkstones[currentIndex];

    if (isSolved) {
      // "重新挑战" mode: clear solved state, re-shuffle
      Swal.fire({
        title: '重新挑战',
        text: '将清除当前成果，重新拼字，确定吗？',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '重新挑战',
        cancelButtonText: '取消',
        customClass: {
          popup: 'swal2-popup',
          title: 'swal2-title',
          confirmButton: 'swal2-confirm'
        }
      }).then((result) => {
        if (result.isConfirmed) {
          // Clear state
          delete inkstoneStates[currentIndex];
          isSolved = false;
          revealedHints = [];

          resetUnsolvedUI();
          renderWordBlocks(data.nameChars);

          if (sortableInstance) sortableInstance.destroy();
          initSortable();
        }
      });
    } else {
      // "散字重排" mode: just re-shuffle blocks
      renderWordBlocks(data.nameChars);

      if (sortableInstance) sortableInstance.destroy();
      initSortable();

      // Save re-shuffled state
      saveCurrentState();
    }
  }

  // ---------- Navigation: Prev / Next ----------
  function handlePrev() {
    if (currentIndex <= 0) return;
    saveCurrentState();
    AudioEngine.playButton();
    loadInkstone(currentIndex - 1);
  }

  function handleNext() {
    saveCurrentState();
    AudioEngine.playButton();
    loadInkstone(currentIndex + 1);
  }

  function updateNavArrows() {
    if (currentIndex <= 0) {
      navPrev.classList.add('nav-arrow--disabled');
    } else {
      navPrev.classList.remove('nav-arrow--disabled');
    }
  }

  // ---------- Multi-Hint System ----------
  function showNextHint() {
    const data = inkstones[currentIndex];

    if (isSolved) {
      Swal.fire({
        title: '💡 砚台摘要',
        text: data.tip,
        confirmButtonText: '善',
        customClass: {
          popup: 'swal2-popup',
          title: 'swal2-title',
          confirmButton: 'swal2-confirm'
        }
      });
      return;
    }

    AudioEngine.playButton();

    const nextHintIdx = [0, 1, 2].find(i => !revealedHints.includes(i));

    if (nextHintIdx === undefined) {
      Swal.fire({
        title: '💡 三重提示已尽',
        text: '三则提示俱已奉上，请移字归序。\n\n' + data.tip,
        confirmButtonText: '领命',
        customClass: {
          popup: 'swal2-popup',
          title: 'swal2-title',
          confirmButton: 'swal2-confirm'
        }
      });
      return;
    }

    revealedHints.push(nextHintIdx);
    const hintText = data.hints[nextHintIdx];

    const bulb = hintBulbs.querySelector(`[data-hint="${nextHintIdx}"]`);
    if (bulb) bulb.classList.add('hint-bulb--lit');

    updateHintGuideText();
    saveCurrentState();

    Swal.fire({
      title: `💡 提示 ${revealedHints.length} / 3`,
      text: hintText,
      confirmButtonText: '领受',
      showClass: { popup: 'animate__animated animate__fadeIn' },
      hideClass: { popup: 'animate__animated animate__fadeOut' },
      customClass: {
        popup: 'swal2-popup',
        title: 'swal2-title',
        confirmButton: 'swal2-confirm'
      }
    });
  }

  function reviewHint(hintIdx) {
    const data = inkstones[currentIndex];
    AudioEngine.playButton();
    Swal.fire({
      title: `💡 提示 ${hintIdx + 1} / 3（回顾）`,
      text: data.hints[hintIdx],
      confirmButtonText: '记下了',
      customClass: {
        popup: 'swal2-popup',
        title: 'swal2-title',
        confirmButton: 'swal2-confirm'
      }
    });
  }

  function updateHintGuideText() {
    const remaining = 3 - revealedHints.length;
    if (remaining > 0) {
      hintGuideText.textContent = `💡 已得提示 ${revealedHints.length}/3，尚可再触砚图 ${remaining} 次`;
    } else {
      hintGuideText.textContent = '💡 三重提示已尽，可点击亮起的灯泡回看';
    }
  }

  function resetBulbs() {
    bulbEls.forEach(b => b.classList.remove('hint-bulb--lit'));
  }

  // ---------- Culture Card ----------
  function expandCultureCard(data) {
    cultureName.textContent = '「' + data.fullName + '」';
    cultureMeta.textContent = `材质：${data.material}　|　年代：${data.era}`;
    cultureDesc.textContent = data.description;
    cultureCard.classList.add('expanded');
  }

  function collapseCultureCard() {
    cultureCard.classList.remove('expanded');
    setTimeout(() => {
      cultureName.textContent = '';
      cultureMeta.textContent = '';
      cultureDesc.textContent = '';
    }, 400);
  }

  // ---------- All Complete ----------
  function handleAllComplete() {
    AudioEngine.playComplete();

    currentIndex = inkstones.length;
    progressCurrent.textContent = '12';
    updateNavArrows();

    Swal.fire({
      title: '🎉 容载万方，十二方尽览',
      html: `
        <p style="font-size:1rem;line-height:1.8;margin:0.5rem 0;">
          君已遍览<b>十二方</b>端砚珍品，一一叩名定字。
        </p>
        <p style="font-size:0.85rem;color:#8b6f47;margin-top:0.5rem;">
          谢志峰先生捐赠 · 肇庆市博物馆藏
        </p>
        <p style="font-size:0.8rem;color:#8b7355;margin-top:0.75rem;line-height:1.7;">
          端溪之石，千年不朽；文人之砚，万载存真。<br>
          容载万方，砚以载道。<br>
          诚邀亲临肇庆市博物馆，于砚池之间沉吟古今。
        </p>
      `,
      icon: 'success',
      confirmButtonText: '从头再品',
      showClass: { popup: 'animate__animated animate__fadeInUp' },
      customClass: {
        popup: 'swal2-popup',
        title: 'swal2-title',
        confirmButton: 'swal2-confirm'
      }
    }).then(() => {
      // Clear all states
      for (const key in inkstoneStates) delete inkstoneStates[key];
      btnNext.textContent = '览下一方 →';
      loadInkstone(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ---------- Bootstrap ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

(function () {
  const Home = window.IoriHome = window.IoriHome || {};

  Home.initCategoryNavigation = function () {
    const navContainer = document.getElementById('horizontalCategoryNav');
    const moreWrapper = document.getElementById('horizontalMoreWrapper');
    const moreBtn = document.getElementById('horizontalMoreBtn');
    const dropdown = document.getElementById('horizontalMoreDropdown');
    const cardController = Home.cardController;
    let checkOverflow = () => { };
    let resetNav = () => { };

    if (navContainer && moreWrapper && moreBtn && dropdown) {
      resetNav = () => {
        const dropdownItems = Array.from(dropdown.children);
        dropdownItems.forEach(item => {
          if (item.dataset.originalClass) item.className = item.dataset.originalClass;
          const link = item.querySelector('a');
          if (link && link.dataset.originalClass) link.className = link.dataset.originalClass;
          navContainer.insertBefore(item, moreWrapper);
        });
        moreWrapper.classList.add('hidden');
        moreBtn.classList.remove('active', 'text-primary-600', 'bg-secondary-100');
        moreBtn.classList.add('inactive');
      };

      // 单行模式的原始 max-height（来自 SSR inline style），用于每次重算前恢复
      const singleLineMaxHeight = navContainer.style.maxHeight || '60px';
      // 风格三 height:auto + align-items:center 时，同行元素 offsetTop 可能差几像素，
      // 严格相等会把「未换行」误判为换行，最终把全部分类塞进「更多」只剩三个点。
      const ROW_TOLERANCE_PX = 6;

      const getCategories = () => Array.from(navContainer.children).filter(el => el !== moreWrapper);

      const getRowTop = (el) => el.getBoundingClientRect().top;

      const isSameRow = (a, b) => Math.abs(getRowTop(a) - getRowTop(b)) <= ROW_TOLERANCE_PX;

      const enableMultiLineFallback = () => {
        resetNav();
        navContainer.style.maxHeight = 'none';
        navContainer.style.overflow = 'visible';
      };

      checkOverflow = () => {
        resetNav();
        // 恢复单行约束后再测量（避免上次 fallback 的 inline 样式残留）
        navContainer.style.maxHeight = singleLineMaxHeight;
        navContainer.style.overflow = 'hidden';

        const navChildren = getCategories();
        if (navChildren.length === 0) return;

        const firstItem = navChildren[0];
        const lastItem = navChildren[navChildren.length - 1];

        if (isSameRow(firstItem, lastItem)) {
          navContainer.style.overflow = 'visible';
          return;
        }

        moreWrapper.classList.remove('hidden');

        while (true) {
          const currentCategories = getCategories();
          if (currentCategories.length === 0) break;

          const rowAnchor = currentCategories[0];
          const lastCategory = currentCategories[currentCategories.length - 1];
          const moreWrapperWraps = !isSameRow(rowAnchor, moreWrapper);
          const lastCategoryWraps = !isSameRow(rowAnchor, lastCategory);

          if (!moreWrapperWraps && !lastCategoryWraps) break;

          // 至少保留一个可见分类，避免界面只剩「···」
          if (currentCategories.length === 1) break;

          if (!lastCategory.dataset.originalClass) {
            lastCategory.dataset.originalClass = lastCategory.className;
          }

          lastCategory.className = 'menu-item-wrapper block w-full relative';

          const link = lastCategory.querySelector('a');
          if (link) {
            link.dataset.originalClass = link.className;
            const isActive = link.classList.contains('active');
            link.className = 'dropdown-item w-full text-left px-4 py-2 text-sm';
            if (isActive) link.classList.add('active');
          }

          dropdown.insertBefore(lastCategory, dropdown.firstChild);
        }

        const remaining = getCategories();
        // 仍无法把 more 放进首行时，退回多行展示全部分类
        if (remaining.length === 0 || (remaining.length > 0 && !isSameRow(remaining[0], moreWrapper))) {
          enableMultiLineFallback();
          return;
        }

        const activeInDropdown = dropdown.querySelector('.active');
        if (activeInDropdown) {
          moreBtn.classList.add('active');
          moreBtn.classList.remove('inactive');
          moreBtn.classList.add('text-primary-600', 'bg-secondary-100');
        }

        navContainer.style.overflow = 'visible';
      };

      setTimeout(checkOverflow, 100);
      window.addEventListener('resize', () => {
        clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(checkOverflow, 100);
      });

      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = dropdown.classList.contains('hidden');
        if (isHidden) {
          dropdown.classList.remove('hidden');
          document.body.classList.add('menu-open');
        } else {
          dropdown.classList.add('hidden');
          document.body.classList.remove('menu-open');
        }
      });

      dropdown.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) {
          dropdown.classList.add('hidden');
          document.body.classList.remove('menu-open');
        }
      });

      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !moreBtn.contains(e.target)) {
          dropdown.classList.add('hidden');
          document.body.classList.remove('menu-open');
        }
      });
    }

    document.addEventListener('click', async (e) => {
      const link = e.target.closest('a[href^="?catalog="]');
      if (!link) return;

      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      e.preventDefault();
      const href = link.getAttribute('href');
      const catalogId = link.getAttribute('data-id');
      const catalogName = link.textContent.trim();

      Home.closeSidebarMenu?.();

      const sitesGrid = document.getElementById('sitesGrid');
      if (!sitesGrid) return;

      sitesGrid.style.transition = 'opacity 0.15s ease-out';
      sitesGrid.style.opacity = '0';

      try {
        if (!window.IORI_SITES || !cardController) {
          window.location.href = href;
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 50));

        sitesGrid.style.transition = 'none';
        sitesGrid.style.opacity = '1';

        const filteredSites = cardController.getSitesForCatalog(catalogId);
        cardController.setActiveCatalogId(catalogId);
        cardController.renderSites(filteredSites);
        Home.updateHeading?.(null, catalogId ? catalogName : null, filteredSites.length);
        updateNavigationState(catalogId);

        const config = window.IORI_LAYOUT_CONFIG || {};
        if (config.rememberLastCategory) {
          if (catalogId) {
            localStorage.setItem('iori_last_category', catalogId);
            setCookie('iori_last_category', catalogId, 365);
          } else {
            localStorage.setItem('iori_last_category', 'all');
            setCookie('iori_last_category', 'all', 365);
          }
        }
      } catch (err) {
        console.error('Client-side navigation failed:', err);
      }
    });

    function setCookie(name, value, days) {
      let expires = "";
      if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
      }
      document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
    }

    function updateNavigationState(catalogId) {
      const allLinks = document.querySelectorAll('a.nav-btn, a.dropdown-item');
      allLinks.forEach(link => {
        const linkId = link.getAttribute('data-id');
        const isActive = (!catalogId && !linkId) || (String(linkId) === String(catalogId));

        if (isActive) {
          link.classList.remove('inactive');
          link.classList.add('active', 'nav-item-active');
        } else {
          link.classList.remove('active', 'nav-item-active');
          link.classList.add('inactive');
        }
        link.dataset.originalClass = link.className;
      });

      if (navContainer) {
        const topWrappers = Array.from(navContainer.children);
        topWrappers.forEach(wrapper => {
          const topLink = wrapper.querySelector(':scope > a.nav-btn');
          if (!topLink) return;

          const topLinkId = topLink.getAttribute('data-id');
          if (String(topLinkId) !== String(catalogId)) {
            const subLink = wrapper.querySelector(`a[data-id="${catalogId}"]`);
            if (subLink) {
              topLink.classList.remove('inactive');
              topLink.classList.add('active', 'nav-item-active');
              topLink.dataset.originalClass = topLink.className;
            }
          }
        });
      }

      if (dropdown && moreBtn) {
        const activeInDropdown = dropdown.querySelector('.active');
        if (activeInDropdown) {
          moreBtn.classList.add('active', 'text-primary-600', 'bg-secondary-100');
          moreBtn.classList.remove('inactive');
        } else {
          moreBtn.classList.remove('active', 'text-primary-600', 'bg-secondary-100');
          moreBtn.classList.add('inactive');
        }
      }

      if (!catalogId) {
        const allBtn = document.querySelector('a[href="?catalog=all"]');
        if (allBtn) {
          allBtn.classList.remove('inactive');
          allBtn.classList.add('active', 'nav-item-active');
        }
      }

      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        const links = sidebar.querySelectorAll('a[data-id], a[href="?catalog=all"]');
        links.forEach(link => {
          const svg = link.querySelector('svg');
          const linkId = link.getAttribute('data-id');
          const isActive = (!catalogId && !linkId) || (String(linkId) === String(catalogId));

          if (isActive) {
            link.classList.remove('hover:bg-gray-100', 'text-gray-700', 'dark:hover:bg-gray-800', 'dark:text-gray-300');
            link.classList.add('bg-secondary-100', 'text-primary-700', 'dark:bg-gray-800', 'dark:text-primary-400');

            if (svg) {
              svg.classList.remove('text-gray-400', 'dark:text-gray-500');
              svg.classList.add('text-primary-600', 'dark:text-primary-400');
            }
          } else {
            link.classList.remove('bg-secondary-100', 'text-primary-700', 'dark:bg-gray-800', 'dark:text-primary-400');
            link.classList.add('hover:bg-gray-100', 'text-gray-700', 'dark:text-gray-300', 'dark:hover:bg-gray-800');

            if (svg) {
              svg.classList.remove('text-primary-600', 'dark:text-primary-400');
              svg.classList.add('text-gray-400', 'dark:text-gray-500');
            }
          }
        });
      }
    }

    function restoreLastCategory() {
      const config = window.IORI_LAYOUT_CONFIG || {};
      const urlParams = new URLSearchParams(window.location.search);
      const hasCatalogParam = urlParams.has('catalog');

      if (!config.rememberLastCategory || hasCatalogParam || !cardController) return;

      let lastId = localStorage.getItem('iori_last_category');

      if (!lastId) {
        const match = document.cookie.match(/iori_last_category=(all|\d+)/);
        if (match) {
          lastId = match[1];
        }
      }

      if (!lastId) return;

      if (String(lastId) === String(config.ssrCatalogId)) {
        return;
      }

      if (lastId === 'all') {
        const allSites = window.IORI_SITES || [];
        cardController.setActiveCatalogId(null);
        cardController.renderSites(allSites);
        Home.updateHeading?.(null, null, allSites.length);
        updateNavigationState(null);
        return;
      }

      const link = document.querySelector(`a[data-id="${lastId}"]`);

      if (link) {
        const catalogName = link.innerText.trim();
        const filteredSites = cardController.getSitesForCatalog(lastId);

        cardController.setActiveCatalogId(lastId);
        cardController.renderSites(filteredSites);
        Home.updateHeading?.(null, catalogName, filteredSites.length);
        updateNavigationState(lastId);
      } else {
        localStorage.removeItem('iori_last_category');
      }
    }

    Home.updateNavigationState = updateNavigationState;
    restoreLastCategory();
  };
})();

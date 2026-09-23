import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicBanners } from '../api/banners';
import { useAsync } from '../hooks/useAsync';
import type { PublicBanner } from '../types/engagement';

const AUTOPLAY_MS = 5000;
const SWIPE_THRESHOLD_PX = 48;

function ChevronIcon({ direction }: { direction: 'prev' | 'next' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BannerSlide({
  banner,
  index,
  active,
}: {
  banner: PublicBanner;
  index: number;
  active: boolean;
}) {
  const className = `banner-strip__slide${active ? ' banner-strip__slide--active' : ''}`;
  const hidden = active ? undefined : true;
  const content = (
    <img
      src={banner.imageUrl}
      alt={banner.imageAlt || banner.title}
      loading={index === 0 ? 'eager' : 'lazy'}
      draggable={false}
    />
  );

  // Internal links use app navigation; anything else falls back to a plain anchor.
  if (banner.linkUrl.startsWith('/')) {
    return (
      <Link className={className} to={banner.linkUrl} tabIndex={active ? 0 : -1} aria-hidden={hidden}>
        {content}
      </Link>
    );
  }
  if (banner.linkUrl) {
    return (
      <a
        className={className}
        href={banner.linkUrl}
        rel="noopener noreferrer"
        tabIndex={active ? 0 : -1}
        aria-hidden={hidden}
      >
        {content}
      </a>
    );
  }
  return (
    <div className={className} aria-hidden={hidden}>
      {content}
    </div>
  );
}

/** Story 7.5 — public banner feed on the storefront home, auto-playing hero carousel. */
export function BannerStrip() {
  const banners = useAsync<PublicBanner[]>(async () => (await fetchPublicBanners()).data, []);
  const items = banners.data ?? [];
  const count = items.length;

  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focusedWithin, setFocusedWithin] = useState(false);
  const [touching, setTouching] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const paused = hovered || focusedWithin || touching;
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setActive((index) => (index + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [count, active, paused, reducedMotion]);

  if (count === 0) {
    return null;
  }

  const current = Math.min(active, count - 1);
  const goTo = (index: number) => setActive(((index % count) + count) % count);

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    touchStartX.current = event.touches[0].clientX;
    setTouching(true);
  };
  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    setTouching(false);
    if (startX === null) return;
    const deltaX = event.changedTouches[0].clientX - startX;
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX) {
      goTo(current + (deltaX < 0 ? 1 : -1));
    }
  };
  const handleTouchCancel = () => {
    touchStartX.current = null;
    setTouching(false);
  };

  return (
    <section className="banner-strip" aria-label="Khuyến mãi nổi bật">
      <div
        className="container banner-strip__carousel"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => {
          // Only keyboard focus pauses autoplay; mouse clicks shouldn't leave it stuck.
          if (document.activeElement?.matches(':focus-visible')) setFocusedWithin(true);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocusedWithin(false);
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <div className="banner-strip__viewport">
          {items.map((banner, index) => (
            <BannerSlide key={banner.id} banner={banner} index={index} active={index === current} />
          ))}
          {count > 1 ? (
            <>
              <button
                type="button"
                className="banner-strip__arrow banner-strip__arrow--prev"
                onClick={() => goTo(current - 1)}
                aria-label="Banner trước"
              >
                <ChevronIcon direction="prev" />
              </button>
              <button
                type="button"
                className="banner-strip__arrow banner-strip__arrow--next"
                onClick={() => goTo(current + 1)}
                aria-label="Banner tiếp theo"
              >
                <ChevronIcon direction="next" />
              </button>
              <div className="banner-strip__dots">
                {items.map((banner, index) => (
                  <button
                    key={banner.id}
                    type="button"
                    className={`banner-strip__dot${index === current ? ' banner-strip__dot--active' : ''}`}
                    onClick={() => goTo(index)}
                    aria-label={`Chuyển đến banner ${index + 1}`}
                    aria-current={index === current ? 'true' : undefined}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

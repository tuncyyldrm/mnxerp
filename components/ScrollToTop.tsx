"use client";
import { useState, useEffect } from 'react';

interface ScrollToTopProps {
  isModalOpen?: boolean;
}

export default function ScrollToTop({ isModalOpen = false }: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let running = false;

    const toggleVisibility = () => {
      if (!running) {
        running = true;
        requestAnimationFrame(() => {
          if (window.scrollY > 300 && !isModalOpen) {
            setIsVisible(true);
          } else {
            setIsVisible(false);
          }
          running = false;
        });
      }
    };

    window.addEventListener("scroll", toggleVisibility, { passive: true });
    toggleVisibility();

    return () => window.removeEventListener("scroll", toggleVisibility);
  }, [isModalOpen]);

  // EKSİK OLAN VE HATAYA SEBEP OLAN FONKSİYON:
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-6 right-6 z-[120] p-3 rounded-full bg-slate-900/90 backdrop-blur-xs text-white shadow-xl transition-all duration-300 hover:bg-blue-600 active:scale-95 ${
        isVisible && !isModalOpen 
          ? "opacity-100 translate-y-0 visible" 
          : "opacity-0 translate-y-10 pointer-events-none invisible"
      }`}
      aria-label="Yukarı git"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}
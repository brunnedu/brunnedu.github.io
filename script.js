// ===== UTILITY FUNCTIONS =====
const isMobile = () => window.innerWidth <= 768;

// ===== SMOOTH SCROLLING =====
document.addEventListener('DOMContentLoaded', () => {
  // Smooth scrolling for anchor links
  const anchorLinks = document.querySelectorAll('a[href^="#"]');
  anchorLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      const targetElement = document.querySelector(targetId);

      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    });
  });

  // ===== INTERSECTION OBSERVER FOR ANIMATIONS =====
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  // Observe all sections for fade-in animation
  const sections = document.querySelectorAll('.section');
  sections.forEach((section) => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(30px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(section);
  });

  // ===== OPTIMIZED HERO SECTION ANIMATIONS =====
  const heroElements = [
    '.greeting',
    '.name',
    '.title-text',
    '.subtitle',
    '.headshot-container',
    '.social-links-container',
    '.quick-links',
    '.scroll-arrow',
  ];

  // Mobile-optimized animation settings
  const animationDelay = isMobile() ? 200 : 300; // Faster on mobile
  const animationDuration = isMobile() ? 0.6 : 0.8; // Shorter duration on mobile

  // Sequential animation for hero elements with performance optimization
  heroElements.forEach((selector, index) => {
    const element = document.querySelector(selector);
    if (element) {
      // Set initial state
      element.style.opacity = '0';

      // Special handling for scroll arrow to preserve centering
      if (selector === '.scroll-arrow') {
        element.style.transform = 'translateX(-50%) translateY(20px)';
      } else {
        element.style.transform = 'translateY(20px)';
      }

      element.style.transition = `opacity ${animationDuration}s ease, transform ${animationDuration}s ease`;

      // Use requestAnimationFrame for smoother animations
      requestAnimationFrame(() => {
        setTimeout(() => {
          element.style.opacity = '1';

          // Special handling for scroll arrow to preserve centering
          if (selector === '.scroll-arrow') {
            element.style.transform = 'translateX(-50%) translateY(0)';
          } else {
            element.style.transform = 'translateY(0)';
          }
        }, index * animationDelay);
      });
    }
  });

  // ===== SCROLL ARROW FUNCTIONALITY =====
  const scrollArrow = document.getElementById('scroll-arrow');
  if (scrollArrow) {
    scrollArrow.addEventListener('click', () => {
      // Scroll to about section
      const aboutSection = document.getElementById('about-me');
      if (aboutSection) {
        aboutSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    });
  }

  // ===== COPYRIGHT YEAR UPDATE =====
  // Update copyright year to current year
  const currentYearElement = document.getElementById('current-year');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear();
  }

  // ===== MOBILE-OPTIMIZED PARTICLES.JS CONFIGURATION =====
  if (typeof particlesJS !== 'undefined') {
    const particleConfig = {
      particles: {
        number: {
          value: isMobile() ? 30 : 50, // Fewer particles on mobile
          density: {
            enable: true,
            value_area: 400,
          },
        },
        color: {
          value: '#000',
        },
        shape: {
          type: 'circle',
          stroke: {
            width: 0,
            color: '#000',
          },
        },
        opacity: {
          value: 0.5,
          random: false,
        },
        size: {
          value: 1, // Smaller particles on mobile
          random: false,
        },
        line_linked: {
          enable: true,
          distance: isMobile() ? 75 : 150, // Shorter connections on mobile
          color: '#777',
          opacity: 0.4,
          width: 0.5,
        },
        move: {
          enable: true,
          speed: isMobile() ? 0.6 : 0.9, // Slower movement on mobile
          direction: 'none',
          random: false,
          straight: false,
          out_mode: 'out',
          bounce: false,
        },
      },
      interactivity: {
        detect_on: 'window',
        events: {
          onhover: {
            enable: !isMobile(), // Disable hover on mobile for better performance
            mode: 'grab',
          },
          onclick: {
            enable: false,
            mode: 'push',
          },
          resize: true,
        },
        modes: {
          grab: {
            distance: 200,
            line_linked: {
              opacity: 0.5,
            },
          },
          repulse: {
            distance: 100,
            duration: 0.4,
          },
          push: {
            particles_nb: 6,
          },
          remove: {
            particles_nb: 2,
          },
        },
      },
      retina_detect: true,
    };

    particlesJS('particles-js', particleConfig);
  }
});

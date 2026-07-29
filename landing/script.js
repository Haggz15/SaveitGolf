// Alternate the hero background between video1 and video2 forever.
(function () {
  var video = document.getElementById('heroVideo');
  if (!video) return;

  var sources = ['../assets/video1.mp4', '../assets/video2.mp4'];
  var current = 0;

  video.loop = false; // we handle looping/switching manually

  video.addEventListener('ended', function () {
    current = (current + 1) % sources.length;
    video.src = sources[current];
    video.load();
    video.play().catch(function () {
      // Autoplay can be blocked until the user interacts with the page.
    });
  });

  video.play().catch(function () {});
})();

// Waitlist form submission.
(function () {
  var form = document.getElementById('waitlistForm');
  var input = document.getElementById('waitlistEmail');
  var message = document.getElementById('waitlistMessage');
  if (!form) return;

  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var email = input.value.trim();

    if (!emailPattern.test(email)) {
      message.textContent = 'Please enter a valid email address.';
      message.classList.add('error');
      return;
    }

    // TODO: wire this up to a real waitlist backend (e.g. Mailchimp, Formspree, a custom API route).
    message.classList.remove('error');
    message.textContent = "You're on the list! We'll be in touch soon.";
    form.reset();
  });
})();

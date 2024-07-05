/* eslint-env jquery, browser */
$(document).ready(() => {

  // // Let user choose a profile picture
  // document.getElementById('profilePicture').addEventListener('change', function() {
  //   var file = this.files[0];
  //   if (file) {
  //     var reader = new FileReader();
  //     reader.onload = function(event) {
  // document.querySelector('.profile').style.display = 'none';
  // document.querySelector('.profile-preview').style.display = 'block';
  // document.querySelector('.profile-preview').src = event.target.result;
  //     };
  //     reader.readAsDataURL(file);
  //   } else {
  //     document.querySelector('.profile').style.display = 'block';
  //     document.querySelector('.profile-preview').style.display = 'none';
  //     document.querySelector('.profile-preview').src = '';
  //   }
  // });
  // function submitForm(event) {
  //   event.preventDefault(); // Empêche l'action par défaut de soumettre le formulaire

  //   var token = $("#floatingInput").val(); // Récupère la valeur de l'input du Github PAT
  //   var url = "https://api.github.com/repos/{owner}/{repo}"; // Remplacez {owner} et {repo} par les informations de votre répertoire cible

  //   // Envoie la requête AJAX
  //   $.ajax({
  //     url: url,
  //     type: "GET",
  //     beforeSend: function(xhr) {
  //       xhr.setRequestHeader("Authorization", "token " + token); // Ajoute l'en-tête Authorization avec le token
  //     },
  //     success: function(response) {
  //       // Succès de la requête
  //       console.log(response);
  //       // Ajoutez votre code pour gérer le succès ici, comme afficher un message de succès ou rediriger l'utilisateur vers la page suivante de l'onboarding
  //     },
  //     error: function(jqXHR, textStatus, errorThrown) {
  //       // Erreur de la requête
  //       console.log(textStatus + ": " + errorThrown);
  //       // Ajoutez votre code pour gérer l'erreur ici, comme afficher un message d'erreur ou demander à l'utilisateur de vérifier ses informations et de réessayer
  //     }
  //   });
  // }
  // Function to smooth scroll until anchor and focus 'sign-up-beta' input field
  function smoothScroll() {
    let anchor = document.getElementById('sign-up-beta');
    anchor.scrollIntoView({ behavior: 'smooth' });
    anchor.focus();
  }

  // Get all "navbar-burger" elements
  const $navbarBurgers = Array.prototype.slice.call(document.querySelectorAll('.navbar-burger'), 0);

  // Add a click event on each of them
  $navbarBurgers.forEach( el => {
    el.addEventListener('click', () => {

      // Get the target from the "data-target" attribute
      const target = el.dataset.target;
      const $target = document.getElementById(target);

      // Toggle the "is-active" class on both the "navbar-burger" and the "navbar-menu"
      el.classList.toggle('is-active');
      $target.classList.toggle('is-active');

    });
  });
});

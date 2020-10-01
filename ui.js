$(async function () {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $userProfile = $("#user-profile");
  const $navUserProfile = $("#nav-user-profile");
  const $navWelcome = $("#nav-welcome");
  const $navSubmit = $("#nav-submit");
  const $favoritedStories = $("#favorited-articles");

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */
  $loginForm.on("submit", async function (evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */
  $createAccountForm.on("submit", async function (evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Log Out Functionality
   */
  $navLogOut.on("click", function () {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
    showHomepage();
  });

  /**
   * Event Handler for Clicking Login
   */
  $navLogin.on("click", function () {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  /**
   *  Event handler for submitting article
   */
  $submitForm.on("submit", async function (event) {
    event.preventDefault(); // don't refresh

    let title = $("#title").val();
    let url = $("#url").val();
    let author = $("#author").val();
    let username = currentUser.username;
    let hostName = getHostName(url);

    let newStoryObj = await storyList.addStory(currentUser, {
      title,
      author,
      url,
      username,
    });

    let $li = $(`
      <li id="${newStoryObj.storyId}" class="id-${newStoryObj.storyId}">
        <span class="star"><i class="far fa-star"></i></span>
        <a class="article-link" href="${newStoryObj.url}" target="a_blank">
          <strong>${newStoryObj.title}</strong>
        </a>
        <small class="article-author">by ${newStoryObj.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${newStoryObj.username}</small>
      </li>`);
    $allStoriesList.prepend($li);

    $submitForm.slideUp("slow");
    $submitForm.trigger("reset");
  });

  /**
   * Event handler for clicking favorite star
   */
  $(".articles-container").on("click", ".star", async function (event) {
    if (!currentUser) return; // can't star favorite if you're not logged in

    let $target = $(event.target);
    let $closestLi = $target.closest("li");
    let storyId = $closestLi.attr("id");

    if ($target.hasClass("far")) {
      await currentUser.addFavorite(storyId);
      $target.closest("i").removeClass("far");
      $target.closest("i").addClass("fas");
    } else if ($target.hasClass("fas")) {
      await currentUser.unFavorite(storyId);
      $target.closest("i").removeClass("fas");
      $target.closest("i").addClass("far");
    }
  });

  /**
   * Event handler for navigation -> submit
   */
  $navSubmit.on("click", function () {
    if (!currentUser) return;

    hideElements();
    $allStoriesList.show();
    $submitForm.slideToggle();
  });

  /**
   * Event handler for navigation to Homepage
   */
  $("body").on("click", "#nav-all", showHomepage);

  /**
   * Event handler for navigation -> favorites
   */
  $("body").on("click", "#nav-favorites", function () {
    hideElements();
    if (!currentUser) return;

    generateFaves();
    $favoritedStories.show();
  });

  /**
   * Event handler for navigation -> my stories
   */
  $("body").on("click", "#nav-my-stories", function () {
    hideElements();
    if (!currentUser) return;

    generateMyStories();
    $ownStories.show();
  });

  /**
   * Event handler for clicking user profile
   */
  $navUserProfile.on("click", function () {
    hideElements();
    $userProfile.show();
  });

  /**
   * Event handler for clicking delete on story
   */
  $ownStories.on("click", ".trash-can", async function (event) {
    let $closestLi = $(event.target).closest("li");
    let storyId = $closestLi.attr("id");

    await storyList.removeStory(currentUser, storyId);
    await generateMyStories();

    hideElements();
    $ownStories.show();
  });

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */
  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();

    if (currentUser) {
      populateProfile();
      showNavForLoggedInUser();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stories
    $allStoriesList.show();

    // update the navigation bar
    showNavForLoggedInUser();

    populateProfile();
  }

  /**
   * Takes the current user's information and populates the HTML user profile
   */
  function populateProfile() {
    $("#profile-name").text(`Name: ${currentUser.name}`);
    $("#profile-username").text(`Username: ${currentUser.username}`);
    $("#profile-account-date").text(
      `Account Created: ${currentUser.createdAt.slice(0, 10)}`
    );
    $navUserProfile.text(`${currentUser.username}`);
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */
  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }

  /**
   * Rendering function similar to generateStories(). Checks to see if the user
   *  has any stories. If not, appends a message saying so. If so, appends each to
   *  the ownStories element.
   */
  async function generateMyStories() {
    $ownStories.empty();

    if (currentUser.ownStories.length === 0) {
      $ownStories.append("<h5>You have yet to add any stories.</h5>");
    } else {
      for (let story of currentUser.ownStories) {
        let ownStoryHTML = generateStoryHTML(story, true);
        $ownStories.append(ownStoryHTML);
      }
    }
  }

  /**
   * Rendering function similar to generateMyStories().
   *
   */
  async function generateFaves() {
    $favoritedStories.empty();

    if (currentUser.favorites.length === 0) {
      $favoritedStories.append(
        "<h5>You have yet to favorite any stories.</h5>"
      );
    } else {
      for (let story of currentUser.favorites) {
        let favoriteHTML = generateStoryHTML(story);
        $favoritedStories.append(favoriteHTML);
      }
    }
  }

  /**
   * A function to render HTML for an individual Story instance
   */
  function generateStoryHTML(story, isOwnStory = false) {
    let hostName = getHostName(story.url);
    let starIcon = `<span class="star"> 
      <i class="${isFavorite(story) ? "fas" : "far"} fa-star"></i></span>`;
    let trashCanIcon = isOwnStory
      ? `<span class="trash-can"><i class="fas fa-trash-alt"></i></span>`
      : "";

    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
        ${trashCanIcon}
        ${starIcon}
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    return storyMarkup;
  }

  /* hide all elements in elementsArr */
  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm,
      $userProfile,
      $favoritedStories,
    ];
    elementsArr.forEach(($elem) => $elem.hide());
  }

  /* for a logged in user, hide login and show logout; hide profile; update nav; show welcome */
  function showNavForLoggedInUser() {
    $navLogin.hide();
    $userProfile.hide();
    $(".main-nav-links, #user-profile").toggleClass("hidden");
    $navWelcome.show();
    $navLogOut.show();
  }

  /**
   * check if story is in current user's favorites
   */
  function isFavorite(story) {
    if (!currentUser) return false;

    let userFavorites = currentUser.favorites.map((st) => st.storyId);
    return userFavorites.includes(story.storyId);
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }

  /**
   * Click handler for homepage navigation; also run on page load
   */
  async function showHomepage() {
    hideElements();
    await generateStories();
    $allStoriesList.show();
  }

  showHomepage();
});

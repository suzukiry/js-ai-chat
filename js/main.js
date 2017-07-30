/* global $ */
// プロフィール画像を設定していないユーザのデフォルト画像
var defaultProfileImageURL = "img/default-profile-image.png";

// 初期ルーム名
var defaultRoomName = "default";

// お気に入りルーム名
var favoritesRoomName = "お気に入り一覧";

// 現在表示しているルーム名
var currentRoomName = null;

// 現在ログインしているユーザID
var currentUID;

// Firebaseから取得したデータを一時保存しておくための変数
var dbdata = {};


/**
 * すべての画面共通で使う関数
 */

// ビュー（画面）を変更する
// OK
function showView(id) {
  $(".view").hide();
  $("#" + id).fadeIn();

  if (id === "chat") {
    console.log("(1) showView(id) >>  loadChatView()");
    loadChatView();
  }
}


/**
 * ログイン・ログアウト関連の関数
 */

// ログインフォームを初期状態に戻す
function resetLoginForm() {
  $(".form-group").removeClass("has-error");
  $(".login__help").hide();
  $(".login__submit-button").removeAttr("disabled").text("ログイン");
}

// ログインした直後に呼ばれる
// OK
function onLogin() {
  console.log("ログイン完了");

  // チャット画面を表示
  console.log("(2) onLogin() >>  showView(\"chat\")");
  showView("chat");
}

// ログアウトした直後に呼ばれる
function onLogout() {
  firebase.database().ref("users").off("value");
  firebase.database().ref("rooms").off("value");
  currentRoomName = null;
  dbdata = {};
  resetLoginForm();
  resetChatView();
  resetSettingsModal();
  showView("login");

  console.log("(3) onLogout()");
}

// ユーザ作成のときパスワードが弱すぎる場合に呼ばれる
function onWeakPassword () {
  resetLoginForm();
  $(".login__password").addClass("has-error");
  $(".login__help").text("6文字以上のパスワードを入力してください").fadeIn();

  console.log("(4) onWeakPassword ()");
  
}

// ログインのときパスワードが間違っている場合に呼ばれる
function onWrongPassword() {
  resetLoginForm();
  $(".login__password").addClass("has-error");
  $(".login__help").text("正しいパスワードを入力してください").fadeIn();

  console.log("(5) onWrongPassword()");
}

// ログインのとき試行回数が多すぎてブロックされている場合に呼ばれる
function onTooManyRequests() {
  resetLoginForm();
  $(".login__submit-button").attr("disabled", "disabled");
  $(".login__help").text("試行回数が多すぎます。後ほどお試しください。").fadeIn();

  console.log("(6) onTooManyRequests()");
}

// ログインのときメールアドレスの形式が正しくない場合に呼ばれる
function onInvalidEmail() {
  resetLoginForm();
  $(".login__email").addClass("has-error");
  $(".login__help").text("メールアドレスを正しく入力してください").fadeIn();
  console.log("(7) onInvalidEmail()");
}

// その他のログインエラーの場合に呼ばれる
function onOtherLoginError(error) {
  resetLoginForm();
  $(".login__help").text("エラー：" + error.message).fadeIn();

  console.log("(8) onOtherLoginError(error) ");
}


/**
 * チャット画面関連の関数
 */

// チャット画面表示用のデータが揃った時に呼ばれる
function showCurrentRoom() {

  if (currentRoomName) {
    console.log("(9-1) showCurrentRoom() >> currentRoomName ");
    console.log("(9-1-A) " + currentRoomName);
    if (!dbdata.rooms[currentRoomName]) {
      // 現在いるルームが削除されたため初期ルームに移動
      showRoom(defaultRoomName);
      console.log("(9-1-B) showRoom(defaultRoomName)" + currentRoomName);
    }
  } else { // ページロード直後の場合
    console.log("(9-2)  ページロード直後の場合 ");
    if (location.hash) { // URLの#以降がある場合はそのルームを表示
      var roomName = decodeURIComponent(location.hash.substring(1));

      console.log("(9-2-A)  :" + roomName);
      if (dbdata.rooms[roomName]) {
        _showRoom(roomName);
      } else { // ルームが存在しないので初期ルームを表示
        showRoom(defaultRoomName);
      }
    } else { // #指定がないので初期ルームを表示
      showRoom(defaultRoomName);
    }
  }
}

// チャットビュー内のユーザ情報をクリア
function resetChatView() {
  console.log("(10)  resetChatView()");
  
  // メッセージ一覧を消去
  clearMessages();

  // ナビゲーションバーの情報を消去
  clearNavbar();

  // ユーザ情報設定モーダルのプレビュー画像を消去
  $(".settings-profile-image-preview").attr({
    src: defaultProfileImageURL,
  });
}

// ナビゲーションバーの情報を消去
function clearNavbar() {
  console.log("(11)  clearNavbar()");

  $(".room-list-menu").text("ルーム");
  $(".menu-profile-name").text("");
  $(".menu-profile-image").attr({
    src: defaultProfileImageURL,
  });
  clearRoomList();
}

// チャット画面の初期化処理
function loadChatView() {

  resetChatView();

  dbdata = {}; // キャッシュデータを空にする

  // ユーザ一覧を取得してさらに変更を監視
  var usersRef = firebase.database().ref("users");
  console.log("(12-1)  loadChatView()");
  // 過去に登録したイベントハンドラを削除
  usersRef.off("value");
  // イベントハンドラを登録
  usersRef.on("value", function(usersSnapshot) {
    // usersに変更があるとこの中が実行される
    console.log("イベントハンドラ usersRef value usersSnapshot");

    dbdata.users = usersSnapshot.val();

    // 自分のユーザデータが存在しない場合は作成
    if (dbdata.users === null || !dbdata.users[currentUID]) {
      var currentUser = firebase.auth().currentUser;

      console.log("(12-3) 自分のユーザデータが存在しない場合は作成");

      if (currentUser) {
        console.log("ユーザデータを作成します");
        firebase.database().ref("users/" + currentUID).set({
          nickname: currentUser.email,
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          updatedAt: firebase.database.ServerValue.TIMESTAMP,
        });

        // このコールバック関数が再度呼ばれるのでこれ以上は処理しない
        console.log("(12-3-A) Return の前");
        return;
      }
    }
    console.log("(12-4) for 文の前");
    for (var uid in dbdata.users) {
      updateNicknameDisplay(uid);
      downloadProfileImage(uid);
    }

    // usersとroomsが揃ったらルームを表示（初回のみ）
    if (currentRoomName === null && dbdata.rooms) {

      showCurrentRoom();
      console.log("(12-5) usersとroomsが揃ったらルームを表示");
    }
  });

  // ルーム一覧を取得してさらに変更を監視
  var roomsRef = firebase.database().ref("rooms");
  // 過去に登録したイベントハンドラを削除
  roomsRef.off("value");

  console.log("イベントハンドラ roomsRef value roomsSnapshot: イベントハンドラ設定前");
  // コールバックを登録
  roomsRef.on("value", function(roomsSnapshot) {
    // roomsに変更があるとこの中が実行される
    console.log("イベントハンドラ roomsRef value roomsSnapshot: ON");

    dbdata.rooms = roomsSnapshot.val();

    // 初期ルームが存在しない場合は作成する
    if (dbdata.rooms === null || !dbdata.rooms[defaultRoomName]) {
      console.log(defaultRoomName + "ルームを作成します");
      firebase.database().ref("rooms/" + defaultRoomName).setWithPriority({
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        createdByUID: currentUID,
      }, 1);

      // このコールバック関数が再度呼ばれるのでこれ以上は処理しない
      console.log("イベントハンドラ roomsRef value roomsSnapshot: ON (初期ルームが存在しない場合)");
      return;
    }

    // ********************* favorite機能追加 *********************  
    // お気に入り一覧が存在しない場合は作成する
    if (dbdata.rooms === null || !dbdata.rooms[favoritesRoomName]) {
      console.log(defaultRoomName + "ルーム(お気に入り一覧)を作成します");
      firebase.database().ref("rooms/" + favoritesRoomName).setWithPriority({
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        createdByUID: currentUID,
      }, 3);
    // ********************* favorite機能追加 *********************  

      // このコールバック関数が再度呼ばれるのでこれ以上は処理しない
      console.log("イベントハンドラ roomsRef value roomsSnapshot: ON (お気に入り一覧が存在しない場合)");
      return;
    }

    console.log("イベントハンドラ roomsRef value roomsSnapshot: ON ((12-14) ルームのshowroomlist前)");

    // ルーム一覧をナビゲーションメニューに表示
    showRoomList(roomsSnapshot);

    // usersデータがまだ来ていない場合は何もしない
    if (!dbdata.users) {
      return;
      console.log("(12-13) usersデータがまだ来ていない場合は何もしない");
    }
    
    console.log("イベントハンドラ roomsRef value roomsSnapshot: ON ((12-15) showCurrentRoom()前)");
    showCurrentRoom(); 
  });
  
  
  // ********************* favorite機能追加 ********************* 
  // favorite 
  var favoritesRef = firebase.database().ref("favorites/" + currentUID);

  // 過去に登録したイベントハンドラを削除
  favoritesRef.off("value");

  // イベントハンドラを登録
  favoritesRef.on("value", function(favoritesSnapshot) {
    
    dbdata.favorites = favoritesSnapshot.val();
    console.log("イベントハンドラ favoritesRef value favoitesSnapshot: ON in loadChatView()");

    showCurrentRoom(); 

  });

  // ********************* favorite機能追加 ********************* 

}

// 動的に追加されたルームを一旦削除する
function clearRoomList() {
  $(".room-list").find(".room-list-dynamic").remove();
  console.log("(13) clearRoomList()");
}

// ルーム一覧をナビゲーションメニュー内に表示する
function showRoomList(roomsSnapshot) {
  // 動的に追加されたルームを一旦削除する
  clearRoomList();
  console.log("(14-1) showRoomList(roomsSnapshot) ");
  
  roomsSnapshot.forEach(function(roomSnapshot) {
  console.log("(14-2) forEachのなか ");
  var roomName = roomSnapshot.key;
    $a = $("<a>", {
      href: "#" + roomName,
      class: "room-list__link",
    }).text(roomName);
    $(".room-list").append(
      $("<li>", {
        class: "room-list-dynamic",
      }).append($a)
    );
    $a.click(function() {
      // ハンバーガーメニューが開いている場合は閉じる
      $("#navbar").collapse("hide");
    });
  });
}

// .message-listの高さを調整する。主にMobile Safari向け。
function setMessageListMinHeight() {
  
  console.log("(15) setMessageListMinHeight()");
  $(".message-list").css({
    // $(window).height() (ブラウザウインドウの高さ)
    // - 51 (ナビゲーションバーの高さ)
    // - 46 (投稿フォームの高さ)
    // + 6 (投稿フォームのborder-radius)
    "min-height": ($(window).height() - 51 - 46 + 6) + "px",
  });
}

// messageを表示する
function addMessage(messageId, message, createdAt) {
  console.log("messageId:" + messageId + "/message.uid:" + message.uid);

  $div = createMessageDiv(messageId, message, createdAt);
  $div.appendTo(".message-list"); //.message-listの下に突っ込む。

  // 一番下までスクロール 
  $("html, body").scrollTop($(document).height());
  console.log("(16) addMessage(messageId, message)");
}

// messageの表示用のdiv（jQueryオブジェクト）を作って返す
function createMessageDiv(messageId, message, createdAt) {

  console.log("(17) createMessageDiv(messageId, message) " + message.text);
  // HTML内のテンプレートからコピーを作成
  if (message.uid === currentUID) { // 送信メッセージ
    $div = $(".message-template .message--sent").clone();
  } else { // 受信メッセージ
    $div = $(".message-template .message--received").clone();
  }

  var user = dbdata.users[message.uid]; //message = snapshot.val()
  if (user) { // ユーザが存在する場合
    // 投稿者ニックネーム
    $div.find(".message__user-name").addClass("nickname-" + message.uid).text(user.nickname);
    // 投稿者プロフィール画像
    $div.find(".message__user-image").addClass("profile-image-" + message.uid);
    if (user.profileImageURL) { // プロフィール画像のURLを取得済みの場合
      $div.find(".message__user-image").attr({
        src: user.profileImageURL,
      });
    }
  }
  // メッセージ本文をセット
  $div.find(".message__text").text(message.text);
  // 投稿日をセット
  $div.find(".message__time").html(formatDate(new Date(message.time)));

  if (currentRoomName === favoritesRoomName) {
  
    $div.find(".message__time").append("<b> Favorite at " + formatDate(new Date(createdAt)) + "</b>");
    
  }

  // id属性をセット(Favoriteボタン用)
  console.log("messageId: " + messageId);

  if (dbdata.favorites === null || !dbdata.favorites[messageId]) { // お気に入りにいない場合
  
    console.log("お気に入りにいない場合");
    //☆を追加する処理
    var unstarringUrl = [];
    unstarringUrl.push("<button type=\"button\" class=\"btn btn-xs btn-default btn-rounded message__unstarring\" id=\"unstarring\">");
    unstarringUrl.push("<span class=\"glyphicon glyphicon-star-empty\"></span>");
    unstarringUrl.push("</button>");

    $div.find(".message__favorite").append(unstarringUrl.join(""));

  } else { // お気に入りにいる場合

    console.log("お気に入りにいる場合");
    //★を追加する処理
    var starringUrl = [];
    starringUrl.push("<button type=\"button\" class=\"btn btn-xs btn-default btn-rounded message__starring\" id=\"starring\">");
    starringUrl.push("<span class=\"glyphicon glyphicon-star\"></span>");
    starringUrl.push("</button>");
    $div.find(".message__favorite").append(starringUrl.join(""));
  }

  // id属性をセット
  $div.attr("id", "message-id-" + messageId);

  return $div;
}

// DataオブジェクトをUNIX時間へ変換
function formatUnixDate(date) {
  var unixTimestamp = Math.round( date.getTime() / 1000 );
}

// DateオブジェクトをHTMLにフォーマットして返す
function formatDate(date) {
  var m = moment(date);
  return m.format("M/D") + "&nbsp;&nbsp;" + m.format("H:mm");

  console.log("(18) formatDate(date) ");
}

// messageを投稿する
function postMessage(message) {
  firebase.database().ref().child("messages/" + currentRoomName).push(message);

  console.log("(19) postMessage(message) ");
}

// ルームを表示する。location.hashを変更することで
// onhashchangeが呼ばれ、そこから_showRoom()が呼ばれる。
function showRoom(roomName) {
  location.hash = encodeURIComponent(roomName);
  
  console.log("(20) showRoom(roomName) ");
  console.log(location.hash);
  
}

// 表示されているメッセージを消去
function clearMessages() {
  $(".message-list").empty();

  console.log("(21) clearMessages() ");

}

// ルームを実際に表示する
function _showRoom(roomName) {

  console.log("(22) _showRoom(roomName)  ");

  if (!dbdata.rooms || !dbdata.rooms[roomName]) {
    console.error("該当するルームがありません:", roomName);
    return;
  }
  
  currentRoomName = roomName;
  clearMessages();
  console.log("_showRoom本処理前");  

  if (currentRoomName === favoritesRoomName){

    //なぜかMarginだけ上書きできない。。。
    $(".comment-form").hide();
    $('.message-list').css({'margin':'0 auto 10 auto','border-width':'0 1px 1px','border-radius':'0 0 10px 10px'});

    console.log("(9-1) $(_showroom 内\".comment-form\").hide() お気に入りルーム内だから");

    // favoritesからメッセージ一覧をダウンロードし、かつメッセージの追加を監視
    var favoritesRef = firebase.database().ref("favorites/" + currentUID).orderByChild("createdAt");

    // 過去に登録したイベントハンドラを削除
    favoritesRef.off("child_added");

    // イベントハンドラを登録
    favoritesRef.on("child_added", function(childSnapshot, prevChildKey) {
  
      if (roomName === currentRoomName) {
        // 追加されたメッセージを表示
        console.log("イベントハンドラ(child_added): addMessages()");
        addMessage(childSnapshot.key, childSnapshot.val().message, childSnapshot.val().createdAt);
      } 
      console.log("addMessage実行無し。");
    });

    // 過去に登録したイベントハンドラを削除
    favoritesRef.off("child_removed");

    // イベントハンドラを登録
    favoritesRef.on("child_removed", function(childSnapshot, prevChildKey) {

      if (currentRoomName === favoritesRoomName) {
        console.log("イベントハンドラ(child_removed): clearMessages()と_showRoom(favoritesRoomName) 実施前" + currentRoomName);
        clearMessages();
        _showRoom(currentRoomName);
      }
    });
    // ナビゲーションバーのルーム表示を更新
    $(".room-list-menu").text(roomName);

  } else {
 
    //入力フォームがない場合は追加、CSS訂正加える。
    if (!$(this).children().hasClass(".comment-form")) {
      $(".comment-form").show();
      $('.message-list').css({'margin':'0 auto 45px auto','border-width':'0 1px','border-radius':'0'});
    }
  
    // ルームのメッセージ一覧をダウンロードし、かつメッセージの追加を監視
    var roomRef = firebase.database().ref("messages/" + roomName);

    // 過去に登録したイベントハンドラを削除
    roomRef.off("child_added");
 
    // イベントハンドラを登録
    roomRef.on("child_added", function(childSnapshot, prevChildKey) {
      console.log("イベントハンドラ roomRef child_added "+ roomName + "/" + currentRoomName);
      if (roomName === currentRoomName) {
        // 追加されたメッセージを表示
        addMessage(childSnapshot.key, childSnapshot.val());
      }
    });

    // ナビゲーションバーのルーム表示を更新
    $(".room-list-menu").text("ルーム: " + roomName);
  }

  // 初期ルームまたは、お気に入り一覧の場合はルーム削除メニューを無効にする
  if (roomName === defaultRoomName || roomName === favoritesRoomName) {
    $(".delete-room-menuitem").addClass("disabled");
  } else {
    $(".delete-room-menuitem").removeClass("disabled");
  }

  // ナビゲーションのドロップダウンメニューで現在のルームをハイライトする
  $(".room-list > li").removeClass("active");
  $(".room-list__link[href='#" + roomName + "']").closest("li").addClass("active");
}

// ルーム作成モーダルの内容をリセットする
function resetCreateRoomModal() {
  $("#create-room-form")[0].reset();
  $(".create-room__room-name").removeClass("has-error");
  $(".create-room__help").hide();

  console.log("(23) resetCreateRoomModal() ");
}

// ルームを削除する
function deleteRoom(roomName) {

  console.log("(24) deleteRoom(roomName) ");

  // 初期ルームは削除不可
  if (roomName === defaultRoomName) {
    throw new Error(defaultRoomName + "ルームは削除できません");
  }

  // TODO: ルームを削除

  // TODO: ルーム内のメッセージも削除

  // TODO: 初期ルームに移動
  // room1を削除
  firebase.database().ref("rooms/" + roomName).remove();

  // room1内のメッセージも削除
  firebase.database().ref("messages/"+roomName).remove();
  
  // 現在いるルームが削除されたため初期ルームに移動
  showRoom(defaultRoomName);
}


/**
 * ユーザ情報設定関連の関数
 */

// settingsModalを初期状態に戻す
function resetSettingsModal() {
  $(".settings-form")[0].reset();

  
  console.log("(25) resetSettingsModal() ");

}

// ニックネーム表示を更新する
function updateNicknameDisplay(uid) {

  console.log("(26) updateNicknameDisplay(uid)  ");

  var user = dbdata.users[uid];
  if (user) {
    $(".nickname-" + uid).text(user.nickname);
    if (uid === currentUID) {
      $(".menu-profile-name").text(user.nickname);
    }
  }
}

// プロフィール画像の表示を更新する
function updateProfileImageDisplay(uid, url) {

  console.log("(27) updateProfileImageDisplay(uid, url) ");

  $(".profile-image-" + uid).attr({
    src: url,
  });
  if (uid === currentUID) {
    $(".menu-profile-image").attr({
      src: url,
    });
  }
}

// プロフィール画像をダウンロードして表示する
function downloadProfileImage(uid) {

  console.log("(28) downloadProfileImage(uid) ");

  var user = dbdata.users[uid];
  if (!user) {
    return;
  }
  if (user.profileImageLocation) {
    // profile-images/abcdef のようなパスから画像のダウンロードURLを取得
    firebase.storage().ref().child(user.profileImageLocation).getDownloadURL().then(function(url) {
      // 画像URL取得成功
      user.profileImageURL = url;
      updateProfileImageDisplay(uid, url);
    }).catch(function(error) {
      console.error("写真のダウンロードに失敗:", error);
      user.profileImageURL = defaultProfileImageURL;
      updateProfileImageDisplay(uid, defaultProfileImageURL);
    });
  } else { // プロフィール画像が未設定の場合
    user.profileImageURL = defaultProfileImageURL;
    updateProfileImageDisplay(uid, defaultProfileImageURL);
  }
}

// ***********************************************************************
$(document).ready(function() {
  // ページロード時に実行する処理。DOM操作が絡む処理はここに入れる。

  /**
   * ログイン・ログアウト関連
   */
  //OK
  // ログイン状態の変化を監視する
  firebase.auth().onAuthStateChanged(function(user) {
    // ログイン状態が変化した

    console.log("(29) onAuthStateChanged(function(user ");

    // トークンリフレッシュのイベントは無視
    if (user && currentUID === user.uid || !user && currentUID === null) {
      return;
    }

    if (user) { // ログイン済
      currentUID = user.uid;
      onLogin();
    } else { // 未ログイン
      currentUID = null;
      onLogout();
    }
  });

  //OK
  // ログインフォームが送信されたらログインする
  $("#login-form").submit(function() {
    console.log("(29_A) #login-form.submit(function() ");

    // フォームを初期状態に戻す
    resetLoginForm();

    // ログインボタンを押せないようにする
    $(".login__submit-button").attr("disabled", "disabled").text("送信中…");

    var email = $("#login-email").val();
    var password = $("#login-password").val();

    // TODO ログイン処理を作る
    // まずはログインを試みる
    console.log("(29_B) signInWithEmailAndPassword");
    console.log("(29_B) signInWithEmailAndPassword 直前" + email + "/" + password);

    // まずはログインを試みる
    firebase.auth().signInWithEmailAndPassword(email, password).catch(function(error) {
    console.log("ログイン失敗:", error);
    if (error.code === "auth/user-not-found") {
      // 該当ユーザが存在しない場合は新規作成する
      firebase.auth().createUserWithEmailAndPassword(email, password).then(function() { // 作成成功
        console.log("ユーザを作成しました");
      }).catch(function(error) { // 作成失敗
        console.error("ユーザ作成に失敗:", error);
      });
    }
  });

    return false;
  });

  // ログアウトがクリックされたらログアウトする
  $(".logout__link").click(function() {
    // ハンバーガーメニューが開いている場合は閉じる
    $("#navbar").collapse("hide");

    firebase.auth().signOut().then(function() { // ログアウト成功
      location.hash = "";
    }).catch(function(error) {
      console.error("ログアウトに失敗:", error);
    });

    return false;
  });


  /**
   * チャット画面関連
   */
  // .message-listの高さを調整
  setMessageListMinHeight();

  $(".comment-form").submit(function() {
    $text = $(".comment-form__text");
    var comment = $text.val();
    if (comment === "") {
      return false;
    }
    $text.val("");

    // TODO: メッセージを投稿する

    var message = {
      uid: currentUID,
      text: comment,
      time: Date.now(),
    };
    console.log(".comment-form: " + message);
    postMessage(message);

    return false;
  });

  //Click star-empty button ☆>>>★に関する処理
  $(document).on('click', '.message__unstarring', function () {
    
    console.log("Starring");

    // msgOwnerId取得
    var msgOwnerId = $(this).parent().siblings(".message__user-name").attr("class").split(" ")[1];
    var indexOfFirstSeperater = msgOwnerId.indexOf( "-" );
    msgOwnerId = msgOwnerId.substring(indexOfFirstSeperater + 1); 

    // msgId取得
    var msgId = $(this).closest(".message").attr("id");    //var msgId = $(this).parent(".message").attr("id");
    msgId = msgId.replace("message-id-", "");

    // comment取得
    var comment = $(this).parent().siblings(".message__text").text();

    if (dbdata.favorites === null || !dbdata.favorites[msgId]) { // // お気に入りにメッセージが存在しない場合

      $(this).attr("class","btn btn-xs btn-default btn-rounded message__starring");
      $(this).find("span").attr("class","glyphicon glyphicon-star");

      return firebase.database().ref('/messages/' + currentRoomName + '/' + msgId  ).once('value').then(function(msgSnapshot) {
  
        var msgCreatedAt = msgSnapshot.val().time;
        console.log(msgCreatedAt);
  
        //Favorite登録準備とその作成・登録
        var message = {
          uid: msgOwnerId,
          text: comment,
          time: msgCreatedAt,
        };
  
        //お気に入りにお気に入り作成時間を追加。
        firebase.database().ref("favorites/" + currentUID + "/" + msgId).set({
          createdAt: firebase.database.ServerValue.TIMESTAMP,
        });
        
        //お気に入りにメッセージを追加。
        firebase.database().ref().child("favorites/" + currentUID + "/" + msgId + "/message/").set(message);

      }).catch(function(error) {
        console.error("Favoriteのための時間属性の取得に失敗:", error);
      });
    } else {
      console.error("お気に入りに存在するから何もしない。 :" + msgId);
    }
  });
  
  //Click star button ★>>>☆に関する処理
  $(document).on('click', '.message__starring', function () {
    console.log("Unstarring");

    // msgId取得
    var msgId = $(this).closest(".message").attr("id");    //var msgId = $(this).parent(".message").attr("id");
    msgId = msgId.replace("message-id-", "");
    console.log("Unstarring: " + msgId);

    if (dbdata.favorites === null || !dbdata.favorites[msgId]) { // // お気に入りにメッセージが存在しない場合
      console.error("お気に入りに存在しないから何もしない。 :" + msgId);

    } else { // お気に入りにメッセージが存在しない場合

      $(this).attr("class","btn btn-xs btn-default btn-rounded message__unstarring");
      $(this).find("span").attr("class","glyphicon glyphicon-star-empty");

      //お気に入りにメッセージを削除。
      firebase.database().ref("favorites/" + currentUID + "/" + msgId).remove();
    }
  });

/**
   * パスワードリセット関連
   */

  $("#passwordResetModal").on("show.bs.modal", function(event) {
    // #passwordResetModalが表示される直前に実行する処理

    // メールアドレスをログインフォームからコピー
    $("#password-reset-email").val( $("#login-email").val() );

    // モーダルの内容をリセット
    $(".password-reset__help").hide();
    $(".password-reset__submit-button").removeAttr("disabled");
  });
  $("#passwordResetModal").on("shown.bs.modal", function(event) {
    // #passwordResetModalが表示された直後に実行する処理

    // メールアドレスの欄にすぐ入力できる状態にする
    $("#password-reset-email").focus();
  });

  // パスワードリセットフォームが送信されたらリセットを実行
  $("#password-reset-form").submit(function() {
    var email = $("#password-reset-email").val();
    if (email) {
      $(".password-reset__submit-button").attr("disabled", "disabled");
      $(".password-reset__help").hide();
      firebase.auth().sendPasswordResetEmail(email).then(function() {
        $("#passwordResetModal").modal("toggle");
        $("#passwordResetEmailSentModal").modal("toggle");
      }).catch(function(error) {
        $(".password-reset__help").text("エラー：" + error.message).fadeIn();
        $(".password-reset__submit-button").removeAttr("disabled");
      });
    }

    return false;
  });


  /**
   * ルーム作成関連
   */

  $("#createRoomModal").on("show.bs.modal", function(event) {
    // #createRoomModalが表示される直前に実行する処理

    // モーダルの内容をリセット
    resetCreateRoomModal();
  });
  $("#createRoomModal").on("shown.bs.modal", function(event) {
    // createRoomModalが表示された直後に実行する処理

    // ハンバーガーメニューが開いている場合は閉じる
    $("#navbar").collapse("hide");

    // ルーム名の欄にすぐ入力できる状態にする
    $("#room-name").focus();
  });

  // ルーム作成フォームが送信されたらルームを作成
  $("#create-room-form").submit(function() {
    var roomName = $("#room-name").val();

    // 頭とお尻の空白文字を除去
    roomName = roomName.replace(/^\s+/, "").replace(/\s+$/, "");
    $("#room-name").val(roomName);

    // Firebaseのキーとして使えない文字が含まれているかチェック
    if (/[.$#\[\]\/]/.test(roomName)) {
      $(".create-room__help").text("ルーム名に次の文字は使えません: . $ # [ ] /").fadeIn();
      $(".create-room__room-name").addClass("has-error");
      return false;
    }

    if (roomName.length < 1 || roomName.length > 20) {
      $(".create-room__help").text("1文字以上20文字以内で入力してください").fadeIn();
      $(".create-room__room-name").addClass("has-error");
      return false;
    }

    if (dbdata.rooms[roomName]) {
      $(".create-room__help").text("同じ名前のルームがすでに存在します").fadeIn();
      $(".create-room__room-name").addClass("has-error");
      return false;
    }

    // TODO: ルーム作成処理
    // priorityを2にすることで初期ルーム（priority=1）より順番的に後になる
    firebase.database().ref("rooms/" + roomName).setWithPriority({
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      createdByUID: currentUID,
    }, 2).then(function() {
      // ルーム作成に成功
      // TODO: ルーム作成に成功した場合は以下2つの処理を実行する
      // モーダルを非表示にする
      $("#createRoomModal").modal("toggle");
      // 作成したルームを表示
      showRoom(roomName);

    }).catch(function(error) {
      console.error("ルーム作成に失敗:", error);
    });



    return false;
  });


  /**
   * ルーム削除関連
   */

  $("#deleteRoomModal").on("show.bs.modal", function(event) {
    // ルーム削除のモーダル表示直前に実行する処理

    if (!currentRoomName) {
      return false;
    }

    // 初期ルームは削除不可のためモーダルを表示しない
    if (currentRoomName === defaultRoomName) {
      return false;
    }

    // モーダルの内容をリセット
    $(".delete-room__name").text(currentRoomName);

    // ハンバーガーメニューが開いている場合は閉じる
    $("#navbar").collapse("hide");
  });

  // ルーム削除ボタンクリックでルームを削除する
  $(".delete-room__button").click(function() {
    deleteRoom(currentRoomName);
    $("#deleteRoomModal").modal("toggle");
  });




  /**
   * ユーザ情報設定関連
   */

  $("#settingsModal").on("show.bs.modal", function(event) {
    // #settingsModalが表示される直前に実行する処理

    if (!dbdata.users) {
      return false;
    }

    // ハンバーガーメニューが開いている場合は閉じる
    $("#navbar").collapse("hide");

    // ニックネームの欄に現在の値を入れる
    $("#settings-nickname").val(dbdata.users[currentUID].nickname);

    var user = dbdata.users[currentUID];
    if (user.profileImageURL) { // プロフィール画像のURLをすでに取得済
      $(".settings-profile-image-preview").attr({
        src: user.profileImageURL,
      });
    } else if (user.profileImageLocation) { // プロフィール画像は設定されているがURLは未取得
      firebase.storage().ref().child("profile-images/" + currentUID).getDownloadURL().then(function(url) {
        $(".settings-profile-image-preview").attr({
          src: url,
        });
      });
    }
  });

  // ニックネーム欄の値が変更されたらデータベースに保存する
  $("#settings-nickname").change(function() {
    var newName = $(this).val();
    if (newName.length === 0) {
      // 入力されていない場合は何もしない
      return;
    }
    firebase.database().ref("users/" + currentUID).update({
      nickname: newName,
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
    });
  });

  // プロフィール画像のファイルが指定されたらアップロードする
  $("#settings-profile-image").change(function() {
    if (this.files.length === 0) { // ファイルが選択されていない場合
      return;
    }

    var file = this.files[0];
    var metadata = {
      contentType: file.type,
    };

    // ローディング表示
    $(".settings-profile-image-preview").hide();
    $(".settings-profile-image-loading-container").css({
      display: "inline-block",
    });

    // ファイルアップロードを開始
    firebase.storage().ref("profile-images/" + currentUID).put(file, metadata).then(function(snapshot) {
      // アップロード成功

      // 画像表示用のURLを取得
      var url = snapshot.metadata.downloadURLs[0];

      // 画像のロードが終わったらローディング表示を消して画像を表示
      $(".settings-profile-image-preview").load(function() {
        $(".settings-profile-image-loading-container").css({
          display: "none",
        });
        $(this).show();
      });
      $(".settings-profile-image-preview").attr({
        src: url,
      });

      // ユーザ情報を更新
      firebase.database().ref("users/" + currentUID).update({
        profileImageLocation: "profile-images/" + currentUID,
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
      });
    }).catch(function(error) {
      console.error("プロフィール画像のアップロードに失敗:", error);
    });
  });

  // ユーザ情報設定フォームが送信されてもページ遷移しない
  $(".settings-form").submit(function() {
    return false;
  });
});

// URLの#以降が変化したらそのルームを表示する
window.onhashchange = function() {
  if (location.hash.length > 1) {
    _showRoom(decodeURIComponent(location.hash.substring(1)));
  }
};

// ウインドウがリサイズされたら.message-listの高さを再調整
$(window).resize(setMessageListMinHeight);

var debug = false;
var tabs_in_action = {}; // tab store
var tabs_in_action_clear_interval = 1 * 60 * 1000; //1 min

function getBossAndActiveTabs(tabs) {
  var boss, active;
  for (var i in tabs) {
    if (tabs[i]) {
      if (boss == null && active == null) {
        boss = tabs[i];
        active = tabs[i];
      }
      if (tabs[i].id < boss.id) {
        boss = tabs[i];
      }
      if (tabs[i].id > active.id) {
        active = tabs[i];
      }
    }
  }
  return {
    'boss': boss,
    'active': active
  };
}

function liteNormalize(url, slash) {
  //cut to path
  if (url.indexOf("?") > 0) {
    url = url.substr(0, url.lastIndexOf('?'));
  }
  if (slash) {
    if (url.charAt(url.length - 1) == "/") {
      url = url.slice(0, url.length - 1);
    }
  } else {
    if (url.charAt(url.length - 1) != "/") {
      url += "/";
    }
  }
  return url;
}

function eco(boss, active, opener) { //no opener dependencies yet
  var params = {
    selected: true
  };
  debug && console.log("boss.url == active.url : " + (boss.url == active.url));
  if (boss.url != active.url) {
    params.url = active.url;
  }
  debug && console.log("boss == active : " + (boss.id == active.id));
  if (boss.id != active.id) {
    try {
      delete tabs_in_action["tab" + active.id];
      delete tabs_in_action["tab" + boss.id];
    } catch (e) {
      debug && console.log("unable to delete ids", active.id, boss.id);
    }
    chrome.tabs.update(boss.id, params);
    chrome.tabs.remove(active.id);
  }
}

function clearTabsInAction() {
  var ts, tabs_to_delete = [];
  var now = Date.now();
  for (var tab in tabs_in_action) {
    ts = tabs_in_action[tab];
    if ((now - ts) > tabs_in_action_clear_interval) {
      tabs_to_delete.push(tab);
    }
  }
  for (var i in tabs_to_delete) {
    debug && console.log("cleaning... ", tabs_to_delete);
    delete tabs_in_action[tabs_to_delete];
  }
}

function onTabUpdate(tabId, changes, tab) {
  if (tabs_in_action.hasOwnProperty("tab" + tabId)) {
    onTabCreated(tab);
  }
}

function onTabCreated(tab) {
  var url = liteNormalize(tab.url, true);
  var attempt = 2;
  url += "*";
  debug && console.log("queryInfo: url : " + url);
  var queryInfo = {
    'url': url
  };
  tabs_in_action["tab" + tab.id] = Date.now();

  function callback(result) {
    var tabs, boss, active, openerId;
    if (result.length == 0) {
      attempt--;
      if (attempt > 0) {
        url = liteNormalize(tab.url, false);
        url += "*";
        queryInfo = {
          'url': url
        };
        chrome.tabs.query(queryInfo, callback);
      }
    }
    if (result && result.length > 0) {
      tabs = getBossAndActiveTabs(result);
      debug && console.log('tabs', tabs);
      boss = tabs.boss;
      active = tabs.active;
      if (active) {
        openerId = active.openerTabId;
      } else {
        active = boss;
      }
      if (openerId) {
        chrome.tabs.get(openerId, function(tab) {
          eco(boss, active, tab);
        });
      } else {
        eco(boss, active, null);
      }
    }
  }
  chrome.tabs.query(queryInfo, callback);

}
chrome.tabs.onCreated.addListener(onTabCreated);
chrome.tabs.onUpdated.addListener(onTabUpdate);

setInterval(clearTabsInAction, tabs_in_action_clear_interval);
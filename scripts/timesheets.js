// 入力内容を解析して、メソッドを呼び出す
// Timesheets = loadTimesheets();

loadTimesheets = function (exports) {
  var Timesheets = function(storage, settings, responder) {
    this.storage = storage;
    this.responder = responder;
    this.settings = settings;

    var self = this;
    this.responder.on('receiveMessage', function(username, message) {
      self.receiveMessage(username, message);
    });
  };

  // メッセージを受信する
  Timesheets.prototype.receiveMessage = function(username, message) {
    // 日付は先に処理しておく
    this.date = DateUtils.parseDate(message);
    this.time = DateUtils.parseTime(message);
    this.datetime = DateUtils.normalizeDateTime(this.date, this.time);
    if(this.datetime !== null) {
      this.dateStr = DateUtils.format("Y/m/d", this.datetime);
      this.datetimeStr = DateUtils.format("Y/m/d H:M", this.datetime);
    }

    // コマンド集
    var commands = [
      ['actionBreakStart', /休憩開始/],
      ['actionBreakEnd', /休憩終了/],
      ['actionSignOut', /(バ[ー〜ァ]*イ|ば[ー〜ぁ]*い|おやすみ|お[つっ]ー|おつ|さらば|お先|お疲|帰|乙|bye|night|(c|see)\s*(u|you)|退勤|ごきげんよ|グ[ッ]?バイ)/],
      ['actionWhoIsOff', /(だれ|誰|who\s*is).*(休|やす(ま|み|む))/],
      ['actionWhoIsIn', /(だれ|誰|who\s*is)/],
      ['actionCancelOff', /(休|やす(ま|み|む)|休暇).*(キャンセル|消|止|やめ|ません)/],
      ['actionOff', /(休|やす(ま|み|む)|休暇)/],
      ['actionSignIn', /(モ[ー〜]+ニン|も[ー〜]+にん|おっは|おは|へろ|はろ|ヘロ|ハロ|hi|hello|morning|出勤)/],
      ['confirmSignIn', /__confirmSignIn__/],
      ['confirmSignOut', /__confirmSignOut__/],
    ];

    // メッセージを元にメソッドを探す
    var command = _.find(commands, function(ary) {
      return(ary && message.match(ary[1]));
    });

    // メッセージを実行
    if(command && this[command[0]]) {
      return this[command[0]](username, message);
    }
  }

  // 休憩開始
  Timesheets.prototype.actionBreakStart = function(username, message) {
    // とりあえず更新は無視
    if(this.datetime) {
      var data = this.storage.get(username, this.datetime);
      // 休憩開始していないとき
      // 休憩開始しているときはとりえあず無視
      if(!data.breakStart) {
        this.storage.set(username, this.datetime, {breakStart: this.datetime});
        this.responder.template("休憩開始", username, this.datetimeStr);
      }
    }
  };

  // 休憩終了
  Timesheets.prototype.actionBreakEnd = function(username, message) {
    // とりあえず更新は無視
    if(this.datetime) {
      var data = this.storage.get(username, this.datetime);
      // 休憩開始しているとき
      if(data.breakStart) {
        var breakStart = data.breakStart;
        // Milliseconds -> Minutes
        var breakTotalMinutes = Math.abs(this.datetime - data.breakStart) / 1000 / 60;
        var btm = breakTotalMinutes;
        // 休憩時間合計がすでにあるとき
        if(data.breakTotal) {
          breakTotalMinutes += data.breakTotal;
        }
        this.storage.set(username, this.datetime, { breakStart: null, breakTotal: breakTotalMinutes});
        this.responder.template("休憩終了", username, btm);
      }
    }
  };

  // 出勤
  Timesheets.prototype.actionSignIn = function(username, message) {
    if(this.datetime) {
      var data = this.storage.get(username, this.datetime);
      if(!data.signIn || data.signIn === '-') {
        this.storage.set(username, this.datetime, {signIn: this.datetime});
        this.responder.template("出勤", username, this.datetimeStr);
      }
      else {
        // 更新の場合は時間を明示する必要がある
        if(!!this.time) {
          this.storage.set(username, this.datetime, {signIn: this.datetime});
          this.responder.template("出勤更新", username, this.datetimeStr);
        }
      }
    }
  };

  // 退勤
  Timesheets.prototype.actionSignOut = function(username, message) {
    if(this.datetime) {
      var data = this.storage.get(username, this.datetime);
      if(!data.signOut || data.signOut === '-') {
        // 退勤時に休憩継続している場合は終了させる
        if (data.breakStart) {
          var breakStart = data.breakStart;
          // Milliseconds -> Minutes
          var breakTotalMinutes = Math.abs(this.datetime - data.breakStart) / 1000 / 60;
          var btm = breakTotalMinutes;
          // 休憩時間合計がすでにあるとき
          if (data.breakTotal) {
            breakTotalMinutes += data.breakTotal;
          }
          this.storage.set(username, this.datetime, { breakStart: null, breakTotal: breakTotalMinutes });
        }
        this.storage.set(username, this.datetime, { signOut: this.datetime });
        this.responder.template("退勤", username, this.datetimeStr);
      }
      else {
        // 更新の場合は時間を明示する必要がある
        if(!!this.time) {
          // 退勤時に休憩継続している場合は終了させる
          if (data.breakStart) {
            var breakStart = data.breakStart;
            // Milliseconds -> Minutes
            var breakTotalMinutes = Math.abs(this.datetime - data.breakStart) / 1000 / 60;
            var btm = breakTotalMinutes;
            // 休憩時間合計がすでにあるとき
            if (data.breakTotal) {
              breakTotalMinutes += data.breakTotal;
            }
            this.storage.set(username, this.datetime, { breakStart: null, breakTotal: breakTotalMinutes });
          }
          this.storage.set(username, this.datetime, { signOut: this.datetime });
          this.responder.template("退勤更新", username, this.datetimeStr);
        }
      }
    }
  };

  // 休暇申請
  Timesheets.prototype.actionOff = function(username, message) {
    if(this.date) {
      var dateObj = new Date(this.date[0], this.date[1]-1, this.date[2]);
      var data = this.storage.get(username, dateObj);
      if(!data.signOut || data.signOut === '-') {
        this.storage.set(username, dateObj, {signIn: '-', signOut: '-', note: message});
        this.responder.template("休暇", username, DateUtils.format("Y/m/d", dateObj));
      }
    }
  };

  // 休暇取消
  Timesheets.prototype.actionCancelOff = function(username, message) {
    if(this.date) {
      var dateObj = new Date(this.date[0], this.date[1]-1, this.date[2]);
      var data = this.storage.get(username, dateObj);
      if(!data.signOut || data.signOut === '-') {
        this.storage.set(username, dateObj, {signIn: null, signOut: null, note: message});
        this.responder.template("休暇取消", username, DateUtils.format("Y/m/d", dateObj));
      }
    }
  };

  // 出勤中
  Timesheets.prototype.actionWhoIsIn = function(username, message) {
    var dateObj = DateUtils.toDate(DateUtils.now());
    var result = _.compact(_.map(this.storage.getByDate(dateObj), function(row) {
      return _.isDate(row.signIn) && !_.isDate(row.signOut) ? row.user : undefined;
    }));

    if(_.isEmpty(result)) {
      this.responder.template("出勤なし");
    }
    else {
      this.responder.template("出勤中", result.sort().join(', '));
    }
  };

  // 休暇中
  Timesheets.prototype.actionWhoIsOff = function(username, message) {
    var dateObj = DateUtils.toDate(DateUtils.now());
    var dateStr = DateUtils.format("Y/m/d", dateObj);
    var result = _.compact(_.map(this.storage.getByDate(dateObj), function(row){
      return row.signIn === '-' ? row.user : undefined;
    }));

    // 定休の処理
    var wday = dateObj.getDay();
    var self = this;
    _.each(this.storage.getUsers(), function(username) {
      if(_.contains(self.storage.getDayOff(username), wday)) {
        result.push(username);
      }
    });
    result = _.uniq(result);

    if(_.isEmpty(result)) {
      this.responder.template("休暇なし", dateStr);
    }
    else {
      this.responder.template("休暇中", dateStr, result.sort().join(', '));
    }
  };

  // 出勤していない人にメッセージを送る
  Timesheets.prototype.confirmSignIn = function(username, message) {
    var self = this;
    var holidays = _.compact(_.map((this.settings.get("休日") || "").split(','), function(s) {
      var date = DateUtils.parseDateTime(s);
      return date ? DateUtils.format("Y/m/d", date) : undefined;
    }));
    var today = DateUtils.toDate(DateUtils.now());

    // 休日ならチェックしない
    if(_.contains(holidays, DateUtils.format("Y/m/d",today))) return;

    var wday = DateUtils.now().getDay();
    var signedInUsers = _.compact(_.map(this.storage.getByDate(today), function(row) {
      var signedIn = _.isDate(row.signIn);
      var off = (row.signIn === '-') || _.contains(self.storage.getDayOff(row.user), wday);
      return (signedIn || off) ? row.user : undefined;
    }));
    var users = _.difference(this.storage.getUsers(), signedInUsers);

    if(!_.isEmpty(users)) {
      this.responder.template("出勤確認", users.sort());
    }

    // バージョンチェックを行う
    if(typeof checkUpdate == 'function') checkUpdate(this.responder);
  };

  // 退勤していない人にメッセージを送る
  Timesheets.prototype.confirmSignOut = function(username, message) {
    var dateObj = DateUtils.toDate(DateUtils.now());
    var users = _.compact(_.map(this.storage.getByDate(dateObj), function(row) {
      return _.isDate(row.signIn) && !_.isDate(row.signOut) ? row.user : undefined;
    }));

    if(!_.isEmpty(users)) {
      this.responder.template("退勤確認", users.sort());
    }
  };

  return Timesheets;
};

if(typeof exports !== 'undefined') {
  exports.Timesheets = loadTimesheets();
}

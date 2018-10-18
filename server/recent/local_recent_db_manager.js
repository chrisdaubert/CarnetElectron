var fs = require('fs');
var getParentFolderFromPath = require('path').dirname;
var lockFile = require('lockfile')
var LocalRecentDBManager = function (path) {
    this.path = path;
    console.log("RecentDBManager with " + path)

}


LocalRecentDBManager.prototype.getFullDB = function (callback) {
    console.log("getFullDB")
    fs.readFile(this.path, "utf8", function (err, data) {
        if (data == undefined || data.length == 0)
            data = "{\"data\":[]}";
        callback(err, JSON.parse(data));
    });
}

LocalRecentDBManager.prototype.actionArray = function (items, action, callback) {
    var db = this;
    var time = new Date().getTime();
    db.getFullDB(function (err, data) {
        var fullDB = JSON.parse(data);
        for (var i of items) {
            var item = new function () {
                this.time = i.time;
                this.action = action;
                this.path = i.path;
            };
            fullDB["data"].push(item);
        }
        require("mkdirp")(getParentFolderFromPath(db.path), function () {
            // opts is optional, and defaults to {} 

            console.log("writing")
            fs.writeFile(db.path, JSON.stringify(fullDB), function (err) {
                if (callback)
                    callback()
            });

        })
    });
}

LocalRecentDBManager.prototype.action = function (path, action, callback) {
    this.action(path, action, new Date().getTime(), callback);
}
LocalRecentDBManager.prototype.action = function (path, action, time, callback) {
    var db = this;
    console.log("action")
    lockFile.lock('recent.lock', {
        wait: 10000
    }, function (er) {
        db.getFullDB(function (err, data) {
            console.log(data)
            var fullDB = data;
            var item = new function () {
                this.time = time;
                this.action = action;
                this.path = path;
            };

            fullDB["data"].push(item);
            console.log(JSON.stringify(item))
            require("mkdirp")(getParentFolderFromPath(db.path), function () {
                // opts is optional, and defaults to {} 

                console.log("writing")
                fs.writeFile(db.path, JSON.stringify(fullDB), function (err) {
                    if (callback)
                        callback()
                    lockFile.unlock('recent.lock', function (er) {
                        console.log("lock er " + er)
                        // er means that an error happened, and is probably bad. 
                    })
                });

            })
        })
    })
}

// sort on key values
function keysrt(key, desc) {
    return function (a, b) {
        return desc ? ~~(a[key] < b[key]) : ~~(a[key] > b[key]);
    }
}
//returns last time
LocalRecentDBManager.prototype.mergeDB = function (path, callback) {
    console.log("merging with " + path);
    var db = this;
    var hasChanged = false;
    lockFile.lock('recent.lock', {
        wait: 10000
    }, function (er) {
        db.getFullDB(function (err, data) {
            lockFile.unlock('recent.lock', function (er) {
                console.log("lock er " + er)
                // er means that an error happened, and is probably bad. 
            })
            var otherDB = new LocalRecentDBManager(path)
            otherDB.getFullDB(function (err, dataBis) {
                var dataJson = data
                try {
                    var dataBisJson = dataBis
                } catch (e) { //bad :(
                    return
                }
                for (let itemBis of dataBisJson["data"]) {
                    var isIn = false;
                    for (let item of dataJson["data"]) {
                        if (itemBis.time == item.time && itemBis.path == item.path && itemBis.action == item.action) {
                            isIn = true;
                            break;
                        }
                    }
                    if (!isIn) {
                        dataJson["data"].push(itemBis);
                        hasChanged = true;
                    }
                }
                dataJson["data"].sort(keysrt('time'))
                if (hasChanged) {
                    require("mkdirp")(getParentFolderFromPath(db.path), function () {
                        // opts is optional, and defaults to {} 
                        lockFile.lock('recent.lock', {
                            wait: 10000
                        }, function (er) {
                            fs.writeFile(db.path, JSON.stringify(dataJson), function (err) {
                                console.log(err);
                                callback(hasChanged);
                            });
                            lockFile.unlock('recent.lock', function (er) {
                                // er means that an error happened, and is probably bad. 
                            })
                        })
                    })
                } else callback(hasChanged);
            });
        })
    });

}

exports.LocalRecentDBManager = LocalRecentDBManager;
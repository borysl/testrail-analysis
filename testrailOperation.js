var http = require("http");

function TestrailOperation(testrailSettings, teamSettings) {
    var self = this;
    var projectId = teamSettings.projectId;

    var optionsTemplate = {
        "method": "GET",
        "hostname": testrailSettings.url,
        "port": null,
        "path": "/index.php?/api/v2/",
        "headers": {
            "content-type": "application/json",
            "authorization": "Basic " + new Buffer(testrailSettings.login + ':' + testrailSettings.password).toString('base64')
        }
    };

    function waitResponseFromGetRequest(query, callback) {
        var options = JSON.parse(JSON.stringify(optionsTemplate)); 

        options.path += query;

        var req = http.request(options, function (res) {
            console.log(`Requesting: ${options.hostname}${options.path}`);
            var chunks = [];

            res.on("data", function (chunk) {
                chunks.push(chunk);
            });

            res.on("end", function () {
                var body = Buffer.concat(chunks);
                var response = JSON.parse(body.toString())
                
                if (callback) {
                    if (response.error) {
                        callback(null, response.error); 
                    } else {
                        callback(response); 
                    }
                } else {
                    console.log(`Getting response ${response}`);
                }
            });

            res.on("error", function (err) {
                callback(null, err);
            });
        });

        req.end();
    }

    self.getMilestones = function (callback) {
        waitResponseFromGetRequest(`get_milestones/${projectId}`, callback);
    }

    self.getRuns = function (milestoneId, callback) {
        waitResponseFromGetRequest(`get_runs/${projectId}&milestone_id=${milestoneId}`, callback);
    }

    self.getTests = function (suiteId, callback) {
        waitResponseFromGetRequest(`get_tests/${suiteId}`, callback);
    }

    self.getStatuses = function (callback) {
        waitResponseFromGetRequest(`get_statuses`, callback);
    }

    self.getCaseTypes = function (callback) {
        waitResponseFromGetRequest(`get_case_types`, callback);
    }

    self.getCases = function (suiteId, callback) {
        waitResponseFromGetRequest(`get_cases/${projectId}&suite_id=${suiteId}`, callback);
    }
    return self;
}

module.exports = TestrailOperation;
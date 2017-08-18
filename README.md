# TestRail-analysis

Tool creats solid daily CSV report by getting data from [TestRail](http://www.gurock.com/testrail/) from one side and [Atlassian JIRA](https://jira.atlassian.com/) from another.

## Getting Started

You need to have [Node.js](https://nodejs.org/) in your environment. v6.10.0 is recommended.
Result reports can be opened in Excel, OpenSheet, Google Spreadsheets or any other popular tool that deals with csv files.
No compilation is needed.

### Prerequisites

Install nodejs on your computer (npm should be included)
Install git

### Installing

Grab tool from github in pure form.

```
git clone https://github.com/borysl/testrail-analysis/
```

Open workfolder testrail-analysis.

Install prerequites by using command

```
npm i
```

## Settings

Open testrailSettings.json and tune up all parameters: your corporate login, password and URLs to testrail and JIRA.
File teamSettings.json basically contains standard configuration of test rail, however if you are sure that other case types and status are used, or have just different Id fix it up also.
You might get list of the case types by using request:
http://testrail.corp/index.php?/api/v2/get_case_types
and statuses:
http://testrail.corp/index.php?/api/v2/get_statuses
where testrail.corp is URL to your test rail.

Also helpful might [TestRail API description](http://docs.gurock.com/testrail-api2/start)


## Run

Just use standard npm bootstraper
```
npm start
```

File testRails_yyyy-MM-dd.csv should showup in your working folder 


## Deployment

Add additional notes about how to deploy this on a live system

## Contributing

Create pull request - I will review.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/borysl/testrail-analysis/tags). 

## Authors

* **Borys Lebeda** - *Initial work* - [Borysl](https://github.com/borysl)

See also the list of [contributors](https://github.com/borysl/testrail-analysis/contributors) who participated in this project.
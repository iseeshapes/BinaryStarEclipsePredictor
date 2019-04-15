'use strict';

const path = require('path')
const fs = require ('fs');
const express = require('express');
const app = express();
const port = 3000;

const JulianDate = require('./modules/julianDate');
const julianDate = new JulianDate ();
const Equatorial = require('./modules/equatorial');
const equatorial = new Equatorial ();

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'html/index.html'))
})

function toRadians(degrees) {
  return degrees * Math.PI / 180.0;
}

function toDegrees(radians) {
  return radians * 180.0 / Math.PI;
}

function createTimeAndPosition (time, binaryStar, longitude, latitude) {
  var hourAngle = equatorial.calculateHourAngleFromEquatorial(time, longitude,
    binaryStar.rightAscension);
  var altitude = equatorial.calculateAltitude (hourAngle, binaryStar.declination,
    latitude);
  var azimuth = equatorial.calculateAzimuth (hourAngle, binaryStar.declination,
    latitude, altitude);

  return {
    date: julianDate.getDate (time),
    azimuth: toDegrees(azimuth),
    altitude: toDegrees(altitude)
  }
}

app.get("/search/longitude/:longitude/latitude/:latitude/miniumAltitude/:miniumAltitude/maximumMagnitude/:maximumMagnitude", (request, response) => {
  if (request.params.longitude == null || request.params.longitude == undefined) {
    response.status(500).json({ message : "No 'longitude' parameter defined in query string" });
    return;
  }

  if (request.params.latitude == null || request.params.latitude == undefined) {
    response.status(500).json({ message : "No 'latitude' parameter defined in query string" });
    return;
  }

  if (request.params.miniumAltitude == null || request.params.miniumAltitude == undefined) {
    response.status(500).json({ message : "No 'miniumAltitude' parameter defined in query string" });
    return;
  }

  if (request.params.maximumMagnitude == null || request.params.maximumMagnitude == undefined) {
    response.status(500).json({ message : "No 'maximumMagnitude' parameter defined in query string" });
    return;
  }

  var longitude = toRadians(request.params.longitude);
  var latitude = toRadians(request.params.latitude);
  var miniumAltitude = request.params.miniumAltitude;
  var maximumMagnitude = request.params.maximumMagnitude;

  var rawData = fs.readFileSync ('data/binaryStarData.json');
  var binaryStars = JSON.parse(rawData);

  var results = [];

  var startTime = julianDate.getStartJulianDate();
  var endTime = julianDate.getEndJulianDate();

  var midEclipseTime, startEclipseTime, endEclipseTime;
  var midEclipse, startEclipse, endEclipse;

  for (var i=0;i<binaryStars.length;i++) {
    if (binaryStars[i].minimumMagnitude > maximumMagnitude
      || binaryStars[i].maximumMagnitude > maximumMagnitude) {
      continue;
    }

    midEclipseTime = binaryStars[i].epoch;
    while (midEclipseTime < startTime) {
      midEclipseTime += binaryStars[i].period;
    }

    if (binaryStars[i].eclipseTime > 0) {
      startEclipseTime = midEclipseTime - binaryStars[i].eclipseTime / 2;
      endEclipseTime = midEclipseTime + binaryStars[i].eclipseTime / 2;

      if (startEclipseTime < startTime  || endEclipseTime > endTime) {
        continue;
      }

      startEclipse = createTimeAndPosition(startEclipseTime, binaryStars[i], longitude, latitude);
      midEclipse = createTimeAndPosition(midEclipseTime, binaryStars[i], longitude, latitude);
      endEclipse = createTimeAndPosition(endEclipseTime, binaryStars[i], longitude, latitude);

      if (startEclipse.altitude < miniumAltitude
        || midEclipse.altitude < miniumAltitude
        || endEclipse.altitude < miniumAltitude) {
        continue;
      }
    } else {
      if (midEclipseTime < startTime  || midEclipseTime > endTime) {
        continue;
      }

      midEclipse = createTimeAndPosition(midEclipseTime, binaryStars[i], longitude, latitude);
      if (midEclipse.altitude < miniumAltitude) {
        continue;
      }
      startEclipse = null;
      endEclipse = null;
    }

    results.push({
      name: binaryStars[i].name,
      type: binaryStars[i].type,
      minimumMagnitude: binaryStars[i].minimumMagnitude,
      maximumMagnitude: binaryStars[i].maximumMagnitude,
      startEclipse: startEclipse,
      midEclipse: midEclipse,
      endEclipse: endEclipse,
    });
  }

  response.status(200).json(results);
});

app.listen(port, () => console.log("listening on port ${port}!"));

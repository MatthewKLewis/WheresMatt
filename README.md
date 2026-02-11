# Where's Matt

A live map tracking Matt's Appalachian Trail thru-hike. Follow along as he makes his way from Harper's Ferry to Katahdin (and beyond).

**View the tracker:** [matthewklewis.github.io/WheresMatt](https://matthewklewis.github.io/WheresMatt/)

## About

Where's Matt is a simple web app that displays Matt's current position on the Appalachian Trail using an interactive Leaflet map. The trail route is drawn from GPS-surveyed centerline data, and progress entries are plotted as markers showing date, mile, and notes.

## How It Works

- **trail.json** - GeoJSON LineString of the Appalachian Trail, built from 3,400+ GPS-surveyed centerline segments (source: ATC/NPS 2005 GPS survey, refined 2014).
- **progress.json** - Array of dated entries with lat/lng, trail mile, and notes, updated as Matt checks in.
- **index.html** - Leaflet map that loads both files and renders the trail, progress line, and markers.

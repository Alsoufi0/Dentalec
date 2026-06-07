# Radiology cases

This folder holds the X-ray teaching cases the radiology module reads through
`manifest.json`. It ships with a few **procedural demo images** so the viewer,
interpreter, and case library work immediately. Replace or extend them with real,
licensed dataset images using the steps below.

## How it works

- `manifest.json` is the single source of truth. Each case points at an image in
  `cases/<type>/` and carries annotations, pathology tags, difficulty, and key
  findings. Add a case by dropping its image in the right folder and appending an
  entry to `cases[]`.
- `annotations.x` / `annotations.y` are **percentages (0-100)** of the image, so
  they line up at any zoom.
- `modality`: use `"image"` for JPEG/PNG/SVG (canvas viewer) or `"dicom"` for a
  `.dcm` file (Cornerstone3D viewer).

## Folders

```
cases/panoramic/    full-mouth panoramic X-rays
cases/periapical/   single/few-tooth periapicals
cases/bitewing/     posterior bitewings
```

## Getting real datasets (manual — these cannot be auto-downloaded)

Each source needs a login or an agreement, so download is a manual step.

### 1. DENTEX (panoramic, CC-BY 4.0)
- Page: https://dentex.grand-challenge.org/data/
- Create a (free) grand-challenge.org account and accept the challenge terms.
- Download the training panoramics (labelled for caries, periapical lesions,
  impacted teeth) and unzip selected images into `cases/panoramic/`.
- **License: CC-BY 4.0 — attribution is required if you publish.** Keep the
  citation in each case's `source` field.

### 2. Roboflow Dental Panoramic
- Page: https://universe.roboflow.com/celldetection-ok5sm/dental-x-ray-panoramic-dataset
- Sign in to Roboflow (free), open the dataset, and use **Download / Export** to
  get the images (raw images are enough; you do not need the label format).
- Check the specific dataset's license on its page before publishing.

### 3. Mendeley Panoramic (tooth-class annotated)
- Page: https://data.mendeley.com/datasets/73n3kz2k4k/3
- Public download (no login). Grab the zip, unpack panoramic images into
  `cases/panoramic/`.
- Cite the Mendeley dataset DOI shown on the page.

### DICOM samples (to exercise the Cornerstone3D path)
- The procedural demos are SVG (`modality: "image"`). To test the DICOM viewer,
  add any `.dcm` file to a case folder and set `modality: "dicom"`.
- Public sample DICOM files: https://www.rubomedical.com/dicom_files/ or the
  Cornerstone example data.

## Regenerating the demo images

```
node scripts/genXrays.mjs
```

This rewrites the `*.svg` demo cases. Safe to delete them once real data is in.

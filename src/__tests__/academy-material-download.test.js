import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lib = readFileSync("src/lib/academy.js", "utf8");
const page = readFileSync("src/pages/AcademyMaterials.jsx", "utf8");
const admin = readFileSync("src/pages/AcademyAdminMaterials.jsx", "utf8");

// The reported symptom: a material of several megabytes arrived as a few
// kilobytes. Verified live against the real bucket, where a 6.00 MB PDF uploaded
// and downloaded byte for byte, and the old app-origin path returned 404. Nothing
// was wrong with the upload and no size cap caused it: the link pointed at the
// single-page app's own origin, so the browser saved its index.html under the
// name of the PDF.
describe("an uploaded material is served through a signed url", () => {
  it("never builds a path on the app origin for a stored object", () => {
    expect(page).not.toMatch(/assetUrl/);
    expect(page).toMatch(/getAcademyMaterialUrl/);
  });

  it("resolves a url per material rather than per render", () => {
    expect(page).toMatch(/const \[urls, setUrls\] = useState/);
  });

  it("returns { url } for a stored object, not Supabase's signedUrl", () => {
    // It returned the raw createSignedUrl result, whose field is signedUrl, so
    // every caller reading `.url` got undefined and opened a blank tab.
    expect(lib).toMatch(/url: data\?\.signedUrl \?\? null/);
  });

  it("keeps a plain path only for files committed to the repository", () => {
    expect(lib).toMatch(
      /storage_kind !== "storage"[\s\S]{0,200}return \{ data: \{ url: `\/\$\{String\(material\.storage_path\)/,
    );
  });

  it("gives an offline copy a url that lasts long enough to be useful", () => {
    // Thirty minutes is no use to someone who downloaded a file to read on a
    // train. The cached thing is the url, so it has to outlive the offline stint.
    expect(lib).toMatch(/MATERIAL_OFFLINE_TTL_SECONDS = 60 \* 60 \* 24 \* 7/);
    expect(lib).toMatch(/offline \? MATERIAL_OFFLINE_TTL_SECONDS : MATERIAL_URL_TTL_SECONDS/);
  });
});

describe("uploads succeed whatever the operating system claims a file is", () => {
  // Storage enforces the bucket's mime allow list against the content type the
  // request carries, and it matches on exactly that. Windows and some Linux
  // desktops report a PDF as application/octet-stream or with no type at all,
  // and every one of those is refused, which is why an upload could "fail
  // properly" with no visible cause.
  it("sends a content type derived from the approved extension", () => {
    expect(lib).toMatch(/contentType: materialContentType\(materialExtension\(file\.name\)\)/);
  });

  it("maps every extension validation allows", () => {
    for (const [extension, type] of [
      [".pdf", "application/pdf"],
      [".png", "image/png"],
      [".jpg", "image/jpeg"],
      [".zip", "application/zip"],
    ]) {
      expect(lib).toMatch(
        new RegExp(`"${extension.replace(".", "\\.")}": "${type}"`),
      );
    }
  });

  it("still refuses a size over the bucket limit, and says so", () => {
    expect(lib).toMatch(/file\.size > MATERIAL_MAX_BYTES/);
    expect(lib).toMatch(/Materials must be 25 MB or smaller\./);
  });

  it("refuses an empty file rather than storing nothing", () => {
    expect(lib).toMatch(/file\.size === 0/);
  });
});

describe("the administrator can open an uploaded file too", () => {
  it("reads the same { url } shape the student page does", () => {
    expect(admin).toMatch(/window\.open\(signed\.url/);
    expect(lib).toMatch(/data: \{ url: data\?\.signedUrl \?\? null, path:/);
  });
});

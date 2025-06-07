function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function downloadUrl(url, index, total) {
  const status = document.getElementById("status");
  const progressWrapper = document.getElementById("progressWrapper");
  const progressBar = document.getElementById("progressBar");
  const sizeInfo = document.getElementById("sizeInfo");

  progressWrapper.classList.remove("hidden");
  progressBar.style.width = "5%";
  status.innerText = `Processing (${index + 1}/${total})...`;
  sizeInfo.innerText = "";

  try {
    const response = await fetch("http://localhost:3000/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) throw new Error("Download failed");

    const disposition = response.headers.get("Content-Disposition");
    const fileName =
      disposition?.split("filename=")[1]?.replaceAll('"', "") || "download.mp3";
    const reader = response.body.getReader();
    const contentLength = +response.headers.get("Content-Length");
    let receivedLength = 0;
    let chunks = [];

    function pump() {
      return reader.read().then(({ done, value }) => {
        if (done) {
          const blob = new Blob(chunks);
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = fileName;
          link.click();
          progressBar.style.width = `100%`;
          status.innerText = `Finished (${index + 1}/${total})`;
          sizeInfo.innerText = `File size: ${formatBytes(receivedLength)}`;
          return;
        }
        chunks.push(value);
        receivedLength += value.length;
        progressBar.style.width = `${Math.round((receivedLength / contentLength) * 100)}%`;
        return pump();
      });
    }
    await pump();
  } catch (err) {
    console.error(err);
    status.innerText = `Error on video ${index + 1}: ${err.message}`;
    progressBar.style.width = `0%`;
  }
}

async function convert() {
  const input = document.getElementById("urlInput").value.trim();
  if (!input) return alert("Please enter at least one YouTube URL");

  const urls = input
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);
  for (let i = 0; i < urls.length; i++) {
    await downloadUrl(urls[i], i, urls.length);
  }
}

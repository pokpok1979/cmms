"use client";
import { useEffect, useState } from "react";

type Attachment = { _id: string; name: string; type?: string };
function ImagePreview({ attachment, index }: { attachment: Attachment; index: number }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/attachments/${encodeURIComponent(attachment._id)}?preview=1`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Preview unavailable");
        return response.json();
      })
      .then(result => { if (live) setUrl(result.url); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [attachment._id]);
  async function openImage(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const tab = window.open("about:blank", "_blank");
    if (!tab) return;
    tab.opener = null;
    try {
      const response = await fetch(`/api/attachments/${encodeURIComponent(attachment._id)}?preview=1`, { cache: "no-store" });
      if (!response.ok) throw new Error("Preview unavailable");
      const result = await response.json();
      tab.location.href = result.url;
    } catch {
      tab.close();
      setFailed(true);
    }
  }
  return <figure className="attachment-image-preview">
    {url && !failed ? <a href={url} target="_blank" rel="noopener noreferrer" onClick={openImage} aria-label={attachment.name}>
      <img src={url} alt={attachment.name} loading="lazy" onError={() => setFailed(true)} />
    </a> : <span>{failed ? "\u0e42\u0e2b\u0e25\u0e14\u0e23\u0e39\u0e1b\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08" : "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14..."}</span>}
    <figcaption>{"\u0e20\u0e32\u0e1e\u0e17\u0e35\u0e48"} {index + 1}</figcaption>
  </figure>;
}
export default function AttachmentGallery({ attachments, title }: { attachments: Attachment[]; title?: string }) {
  const images = attachments.filter(a => a.type === "image/jpeg" || a.type === "image/png").slice(0, 5);
  if (!images.length) return null;
  return <section className="repair-image-gallery">
    <h3>{title ?? "\u0e20\u0e32\u0e1e\u0e1b\u0e23\u0e30\u0e01\u0e2d\u0e1a\u0e01\u0e32\u0e23\u0e41\u0e08\u0e49\u0e07\u0e0b\u0e48\u0e2d\u0e21"}</h3>
    <p>{"\u0e04\u0e25\u0e34\u0e01\u0e20\u0e32\u0e1e\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e40\u0e1b\u0e34\u0e14\u0e02\u0e19\u0e32\u0e14\u0e43\u0e2b\u0e0d\u0e48\u0e43\u0e19\u0e41\u0e17\u0e47\u0e1a\u0e43\u0e2b\u0e21\u0e48"}</p>
    <div className="repair-image-grid">{images.map((a,index) => <ImagePreview key={a._id} attachment={a} index={index} />)}</div>
  </section>;
}

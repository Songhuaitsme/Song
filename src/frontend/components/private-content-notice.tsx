import { privateContentMessage } from "@/shared/content-access";

export function PrivateContentNotice() {
  return <p className="private-content-notice">{privateContentMessage}</p>;
}

export function PrivateArtwork() {
  return <span className="private-artwork" aria-hidden="true">私藏</span>;
}

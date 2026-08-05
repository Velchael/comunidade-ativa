import React, { useEffect, useMemo, useState } from "react";

const SIZE_CLASS_BY_NAME = {
  publication: "user-avatar--publication",
  reply: "user-avatar--reply",
  profile: "user-avatar--profile"
};

const SIZE_PIXELS_BY_NAME = {
  publication: 40,
  reply: 30,
  profile: 112
};

const isHttpsUrl = (value) => {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    return new URL(trimmed).protocol === "https:";
  } catch (err) {
    return false;
  }
};

const getInitials = (name) => {
  const normalizedName = String(name || "").trim();

  if (!normalizedName) return "?";

  const parts = normalizedName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";

  const firstInitial = parts[0]?.[0] || "";
  const lastInitial = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  const initials = `${firstInitial}${lastInitial}`.trim();

  return initials ? initials.slice(0, 2).toLocaleUpperCase("pt-BR") : "?";
};

export default function UserAvatar({
  src,
  name,
  size = "publication",
  className = ""
}) {
  const safeSrc = typeof src === "string" ? src.trim() : "";
  const [imageFailed, setImageFailed] = useState(false);
  const initials = useMemo(() => getInitials(name), [name]);
  const sizeClass = SIZE_CLASS_BY_NAME[size] || SIZE_CLASS_BY_NAME.publication;
  const pixelSize = SIZE_PIXELS_BY_NAME[size] || SIZE_PIXELS_BY_NAME.publication;
  const classes = ["user-avatar", sizeClass, className]
    .filter(Boolean)
    .join(" ");
  const shouldShowImage = isHttpsUrl(safeSrc) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [safeSrc]);

  if (shouldShowImage) {
    return (
      <img
        className={classes}
        src={safeSrc}
        alt=""
        width={pixelSize}
        height={pixelSize}
        loading="lazy"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <span className={`${classes} user-avatar--fallback`} aria-hidden="true">
      {initials}
    </span>
  );
}

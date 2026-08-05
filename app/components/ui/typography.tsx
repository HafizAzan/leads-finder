import React from "react";

type TextVariants = "h1" | "h2" | "h3" | "h4" | "h6" | "p" | "span" | "div";

type TypographyProps = {
  variants?: TextVariants;
  className?: string;
  text?: string | React.ReactNode;
};

const TypographyClass: Record<TextVariants, string> = {
  h1: "text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight",

  h2: "text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight leading-tight",

  h3: "text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold leading-snug",

  h4: "text-base sm:text-lg md:text-xl lg:text-2xl font-medium leading-snug",

  h6: "text-sm sm:text-base md:text-lg font-medium leading-normal",

  p: "text-sm sm:text-base md:text-lg leading-6 md:leading-7 text-muted",

  span: "text-sm sm:text-base leading-normal",

  div: "text-sm sm:text-base leading-normal",
};

function Typography({
  variants = "h1",
  className = "",
  text = "Hey!",
}: TypographyProps) {
  const classes = `${TypographyClass[variants]} ${className}`;

  switch (variants) {
    case "h1":
      return <h1 className={classes}>{text}</h1>;

    case "h2":
      return <h2 className={classes}>{text}</h2>;

    case "h3":
      return <h3 className={classes}>{text}</h3>;

    case "h4":
      return <h4 className={classes}>{text}</h4>;

    case "h6":
      return <h6 className={classes}>{text}</h6>;

    case "p":
      return <p className={classes}>{text}</p>;

    case "span":
      return <span className={classes}>{text}</span>;

    case "div":
      return <div className={classes}>{text}</div>;
  }
}

export default React.memo(Typography);

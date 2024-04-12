export const trimDoubleUnderscore = (text: string) => {
  if (text.startsWith("__")) {
    return text.slice(2);
  } else {
    return text;
  }
};

export const parseToPrimitive = (value: string | unknown) => {
  try {
    return JSON.parse(String(value));
  } catch (e) {
    return String(value);
  }
};

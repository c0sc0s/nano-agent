import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const env = {
  MODEL_NAME: required("MODEL_NAME"),
  MODEL_API_TOKEN: required("MODEL_API_TOKEN"),
  MODEL_BASE_URL: required("MODEL_BASE_URL"),
};

export default env;

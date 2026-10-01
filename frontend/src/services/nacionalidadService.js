import axios from "axios";

export const getNacionalidades = async () => {
  const { data } = await axios.get("/api/nacionalidades");
  return data;
};
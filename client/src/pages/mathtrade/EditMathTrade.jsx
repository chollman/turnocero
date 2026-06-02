import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import MathTradeForm from "./MathTradeForm";

export default function EditMathTrade() {
  const { id } = useParams();
  const [trade, setTrade] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    axios
      .get(API.mathtrade.DETAIL(id), { signal: ac.signal })
      .then(({ data }) => setTrade(data))
      .catch((err) => {
        if (!axios.isCancel(err)) setError(true);
      });
    return () => ac.abort();
  }, [id]);

  if (error) return null;
  if (!trade) return null;
  return <MathTradeForm mode="edit" initial={trade} />;
}

import { useParams } from "react-router-dom";
import { useMathTradeQuery } from "../../queries/mathtrade";
import MathTradeForm from "./MathTradeForm";

export default function EditMathTrade() {
  const { id } = useParams();
  const { data: trade, isError: error } = useMathTradeQuery(id);

  if (error) return null;
  if (!trade) return null;
  return <MathTradeForm mode="edit" initial={trade} />;
}

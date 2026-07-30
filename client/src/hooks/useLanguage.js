import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setLanguage, toggleLanguage } from "../store/slices/languageSlice";

export const useLanguage = () => {
  const lang = useAppSelector((state) => state.language.value);
  const dispatch = useAppDispatch();
  return {
    lang,
    setLang: (next) => dispatch(setLanguage(next)),
    toggleLang: () => dispatch(toggleLanguage()),
  };
};

export default useLanguage;

import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setTheme, toggleTheme } from "../store/slices/themeSlice";

export const useTheme = () => {
  const theme = useAppSelector((state) => state.theme.value);
  const dispatch = useAppDispatch();
  return {
    theme,
    setTheme: (next) => dispatch(setTheme(next)),
    toggleTheme: () => dispatch(toggleTheme()),
  };
};

export default useTheme;

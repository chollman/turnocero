import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AvatarColorPicker from "./AvatarColorPicker";
import { AVATAR_PALETTE } from "../../utils/hash";

describe("<AvatarColorPicker>", () => {
  it("renders a swatch for every palette color", () => {
    render(<AvatarColorPicker value="" onChange={vi.fn()} initial="C" />);
    for (const token of AVATAR_PALETTE) {
      expect(
        screen.getByLabelText(`Color ${token.replace("--", "")}`),
      ).toBeInTheDocument();
    }
  });

  it("shows the initial in the preview", () => {
    render(<AvatarColorPicker value="--green" onChange={vi.fn()} initial="CH" />);
    expect(screen.getByText("CH")).toBeInTheDocument();
  });

  it("calls onChange with the token when a swatch is clicked", () => {
    const onChange = vi.fn();
    render(<AvatarColorPicker value="" onChange={onChange} initial="C" />);
    fireEvent.click(screen.getByLabelText("Color green"));
    expect(onChange).toHaveBeenCalledWith("--green");
  });

  it("marks the selected swatch as pressed", () => {
    render(<AvatarColorPicker value="--purple" onChange={vi.fn()} initial="C" />);
    expect(screen.getByLabelText("Color purple")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Color amber")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("does not render the Auto option by default", () => {
    render(<AvatarColorPicker value="--red" onChange={vi.fn()} initial="C" />);
    expect(screen.queryByLabelText("Color automático")).toBeNull();
  });

  it("renders the Auto option and reports it as pressed when value is empty", () => {
    const onChange = vi.fn();
    render(
      <AvatarColorPicker
        value=""
        onChange={onChange}
        initial="C"
        allowAuto
      />,
    );
    const auto = screen.getByLabelText("Color automático");
    expect(auto).toHaveAttribute("aria-pressed", "true");
    // Selecting a real color, then Auto, emits "".
    fireEvent.click(screen.getByLabelText("Color amber"));
    expect(onChange).toHaveBeenCalledWith("--amber");
    fireEvent.click(auto);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("disables every swatch when disabled", () => {
    render(
      <AvatarColorPicker value="" onChange={vi.fn()} initial="C" allowAuto disabled />,
    );
    expect(screen.getByLabelText("Color amber")).toBeDisabled();
    expect(screen.getByLabelText("Color automático")).toBeDisabled();
  });
});

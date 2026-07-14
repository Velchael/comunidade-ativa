import React, { useRef } from "react";
import { Button, Dropdown } from "react-bootstrap";

export default function PrimarySelectorBar({
  ariaLabel,
  items,
  mode = "form",
  openKey,
  onOpenChange,
  onSelect,
  hasActiveFilters = false,
  onClear
}) {
  const toggleRefs = useRef({});

  const focusToggle = (selectorKey) => {
    window.setTimeout(() => {
      toggleRefs.current[selectorKey]?.focus();
    }, 0);
  };

  return (
    <div
      className={`primary-selector-bar primary-selector-bar--${mode}`}
      role="group"
      aria-label={ariaLabel}
    >
      <div className="primary-selector-items">
        {items.map((item) => {
          const selectorKey = `${mode}:${item.id}`;
          const toggleId = `primary-selector-${mode}-${item.id}`;
          const menuId = `primary-selector-menu-${mode}-${item.id}`;
          const labelId = `primary-selector-label-${mode}-${item.id}`;
          const valueId = `primary-selector-value-${mode}-${item.id}`;

          return (
            <div className="primary-selector-field" key={selectorKey}>
              <span id={labelId} className="primary-selector-label">
                {item.label}
              </span>

            <Dropdown
              show={openKey === selectorKey}
              onToggle={(nextShow, meta) => {
                onOpenChange(nextShow ? selectorKey : null);

                if (
                  !nextShow &&
                  openKey === selectorKey &&
                  meta?.source === "keydown"
                ) {
                  focusToggle(selectorKey);
                }
              }}
            >
              <Dropdown.Toggle
                id={toggleId}
                ref={(node) => {
                  toggleRefs.current[selectorKey] = node;
                }}
                className="primary-selector-toggle"
                variant="light"
                aria-controls={menuId}
                aria-labelledby={`${labelId} ${valueId}`}
              >
                <span className="primary-selector-toggle-text">
                  <span id={valueId} className="primary-selector-value">
                    {item.valueLabel}
                  </span>
                </span>
              </Dropdown.Toggle>

              <Dropdown.Menu
                id={menuId}
                className="primary-selector-menu"
                align={item.align || undefined}
                aria-labelledby={toggleId}
              >
                {item.options.map((option) => {
                  const selected = option.value === item.value;

                  return (
                    <Dropdown.Item
                      key={option.value}
                      as="button"
                      type="button"
                      active={selected}
                      className="primary-selector-option"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => {
                        onSelect(item.id, option.value);
                        onOpenChange(null);
                        focusToggle(selectorKey);
                      }}
                    >
                      <span
                        className="primary-selector-option-check"
                        aria-hidden="true"
                      >
                        {selected ? "✓" : ""}
                      </span>
                      <span className="primary-selector-option-label">
                        {option.label}
                      </span>
                      {selected && (
                        <span className="visually-hidden">
                          {" "}
                          selecionado
                        </span>
                      )}
                    </Dropdown.Item>
                  );
                })}
              </Dropdown.Menu>
            </Dropdown>
            </div>
          );
        })}
      </div>

      {mode === "filter" && hasActiveFilters && (
        <div className="primary-selector-clear-row">
          <Button
            type="button"
            variant="link"
            className="primary-selector-clear"
            onClick={onClear}
          >
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
}

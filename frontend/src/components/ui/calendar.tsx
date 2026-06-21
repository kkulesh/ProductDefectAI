import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// react-day-picker v9 renamed essentially every classNames key from v8
// (cell -> day, day_selected -> selected, nav_button_previous ->
// button_previous, etc). The previous version of this file used the old
// v8 keys, which v9 silently ignores — falling back to fully unstyled
// markup, which is why the calendar rendered broken and selections didn't
// appear to register.
//
// Verified against react-day-picker's own source
// (DayPicker.js / getClassNamesForModifiers.js): for each day cell, v9
// renders a <td> with className = classNames.day + " " + the active
// modifier's class (classNames.selected / .range_start / .range_middle /
// .range_end / .today / .outside / .disabled), all on that same <td>.
// The inner clickable <button> only ever receives classNames.day_button.
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4 relative",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center h-9",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1 absolute inset-x-0 top-0 justify-between px-1 h-9",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        // Base cell sizing — react-day-picker appends the selection-state
        // class (selected / range_start / etc, below) to this same <td>.
        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        selected:
          "rounded-md [&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground [&>button:focus]:bg-primary [&>button:focus]:text-primary-foreground",
        range_start: "bg-accent rounded-l-md [&>button]:bg-primary [&>button]:text-primary-foreground",
        range_end: "bg-accent rounded-r-md [&>button]:bg-primary [&>button]:text-primary-foreground",
        range_middle: "bg-accent [&>button]:bg-transparent [&>button]:text-accent-foreground",
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };

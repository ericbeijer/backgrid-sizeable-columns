/*
 backgrid-sizeable-columns
 https://github.com/WRidder/backgrid-sizeable-columns

 Copyright (c) 2014 Wilbert van de Ridder
 Licensed under the MIT @license.
 */
(function (root, factory) {
  // CommonJS
  if (typeof exports == "object") {
    module.exports = factory(require("underscore"), require("backgrid"));
  }
  // AMD. Register as an anonymous module.
  else if (typeof define === 'function' && define.amd) {
    define(['underscore', 'backgrid'], factory);
  }
  // Browser
  else {
    factory(root._, root.Backgrid);
  }

}(this, function (_, Backgrid) {
  "use strict";

  // Adds width support to columns
  Backgrid.Extension.SizeAbleColumns = Backbone.View.extend({
    /** @property */
    tagName: "colgroup",

    /**
     * Initializer
     * @param options
     */
    initialize: function (options) {
      this.grid = options.grid;

      // Attach event listeners once on render
      this.listenTo(this.grid.header, "backgrid:header:rendered", this.render);
      this.listenTo(this.grid.columns, "width:auto", this.setWidthAuto);
      this.listenTo(this.grid.columns, "width:fixed", this.setWidthFixed);
      this.listenTo(this.grid, "backgrid:refresh", this.setColToActualWidth);
      this.listenTo(this.grid.collection, "add remove reset", this.setColToActualWidth);
    },

    /**
     * Adds sizeable columns using <col> elements in a <colgroup>
     * @returns {Backgrid.Extension.SizeAbleColumns}
     */
    render: function () {
      var view = this;
      view.$el.empty();

      view.grid.columns.each(function (col) {
        if (typeof col.get("renderable") == "undefined" || col.get("renderable")) {
          var $colEl = $("<col>").appendTo(view.$el).attr("data-column-cid", col.cid);
          var colWidth = col.get("width");
          var colMinWidth = col.get("minWidth");
          var colMaxWidth = col.get("maxWidth");
          if (colWidth && colWidth != "*") {
            if (colMinWidth && colWidth < colMinWidth) {
              colWidth = colMinWidth;
            }
            if (colMaxWidth && colWidth > colMaxWidth) {
              colWidth = colMaxWidth;
            }
            $colEl.width(colWidth);
          }
        }
      });

      // Trigger event
      view.grid.collection.trigger("backgrid:colgroup:changed");
      return this;
    },

    /**
     * Gets a <col> element belonging to given model
     * @param colModel Backgrid.Column
     * @returns {*|JQuery|any|jQuery}
     * @private
     */
    getColumnElement: function (colModel) {
      return this.$el.find('col[data-column-cid="' + colModel.cid + '"]');
    },

    /**
     * Get the column width of given model
     * @param colModel Backgrid.Column
     * @returns {Integer}
     * @private
     */
    getHeaderElementWidth: function(colModel) {
      return this.grid.header.$el.find("th[data-column-cid='" + colModel.cid + "']").outerWidth();
    },

    /**
     * Sets a width of the given column to "*" (auto)
     * @param colModel Backgrid.Column
     * @private
     */
    setWidthAuto: function (colModel) {
      // Get column element
      var $colElement = this.getColumnElement(colModel);

      // Save width
      colModel.set("width", "*");

      // Set column width to auto
      $colElement.css("width", "");

      view.grid.collection.trigger("backgrid:colgroup:updated");
    },

    /**
     * Sets a width of the given column to a fixed width defined in the model.
     * @param colModel Backgrid.Column
     * @private
     */
    setWidthFixed: function (colModel) {
      // Get column element
      var $colElement = this.getColumnElement(colModel);

      // Get width of header element
      var width = this.getHeaderElementWidth(colModel);

      // Set column width to the original width
      $colElement.css("width", width);

      // Save width
      colModel.set("width", width);

      view.grid.collection.trigger("backgrid:colgroup:updated");
    },

    /**
     * Updates the view's <col> elements to current width
     * @private
     */
    setColToActualWidth: function() {
      var view = this;
      var changed = false;
      _.each(view.grid.header.row.cells, function(cell) {
        var $colEl = view.getColumnElement(cell.column);
        if (cell.column.get("width") !== "*") {
          changed = changed || $colEl.width() == cell.$el.outerWidth();
          $colEl.width(cell.$el.outerWidth());
        }
      });

      if (changed) {
        view.grid.collection.trigger("backgrid:colgroup:updated");
      }
    }
  });

  // Makes column resizable; requires Backgrid.Extension.sizeAbleColumns
  Backgrid.Extension.SizeAbleColumnsHandlers = Backbone.View.extend({

    /**
     * Initializer
     * @param options
     */
    initialize: function (options) {
      this.sizeAbleColumns = options.sizeAbleColumns;
      this.grid = this.sizeAbleColumns.grid;
      this.columns = this.grid.columns;
      this.header = this.grid.header;

      this.saveColumnWidth = options.saveColumnWidth;
      this.setHeaderElements();
      this.attachEvents();
    },

    /**
     * Adds handlers to resize the columns
     * @returns {Backgrid.Extension.SizeAbleColumnsHandlers}
     */
    render: function () {
      var view = this;
      view.$el.empty();

      // For now, loop tds in first row
      _.each(view.headerElements, function (columnEl, index) {
        // Get matching col element
        var $column = $(columnEl);
        var $col = view.sizeAbleColumns.$el.find("col").eq(index);
        var columnModel = view.columns.get({ cid: $col.data("column-cid")});

        if (columnModel.get("resizeable") &&
          (typeof columnModel.get("renderable") == "undefined" || columnModel.get("renderable"))) {
          // Create helper elements
          var $resizeHandler = $("<div></div>")
            .addClass("resizeHandler")
            .attr("data-column-index", index)
            .appendTo(view.$el);
          var $resizeHandlerHelper = $("<div></div>")
            .hide()
            .addClass("grid-draggable-cursor")
            .appendTo($resizeHandler);

          // Make draggable
          $resizeHandler.on("mousedown", function (e) {
            view._stopEvent(e);
            var startX = Math.round($resizeHandler.offset().left);
            var $doc = $(document);
            var handlerNonDragSize = $resizeHandler.outerWidth();

            // Set class
            $resizeHandler.addClass("grid-draggable");
            $resizeHandlerHelper.show();

            // Follow the mouse
            var mouseMoveHandler = function (evt) {
              view._stopEvent(evt);

              // Check for constraints
              var minWidth = columnModel.get("minWidth");
              if (!minWidth || minWidth < 20) {
                minWidth = 20;
              }
              var maxWidth = columnModel.get("maxWidth");
              var newLeftPos = evt.pageX;
              var currentWidth = columnModel.get("width");
              var newWidth = currentWidth + (newLeftPos - startX) - handlerNonDragSize / 2;

              if (minWidth && newWidth <= minWidth) {
                newLeftPos = startX - (currentWidth - minWidth) + handlerNonDragSize / 2;
              }
              if (maxWidth && newWidth >= maxWidth) {
                newLeftPos = startX + maxWidth - currentWidth + handlerNonDragSize / 2;
              }

              // Apply mouse change to handler
              $resizeHandler.offset({
                left: newLeftPos
              });
            };
            $doc.on("mousemove", mouseMoveHandler);

            // Add handler to listen for mouseup
            var mouseUpHandler = function (evt) {
              // Cleanup
              view._stopEvent(evt);
              $resizeHandler.removeClass("grid-draggable");
              $resizeHandlerHelper.hide();
              $doc.off("mouseup", mouseUpHandler);
              $doc.off("mousemove", mouseMoveHandler);

              // Adjust column size
              var stopX = Math.round($resizeHandler.offset().left);
              var offset = (startX - stopX);
              var oldWidth = $column.outerWidth();
              var newWidth = oldWidth - offset;
              $col.width(newWidth);

              // Get actual width
              var finalWidth = $column.outerWidth();
              $col.width(finalWidth);

              // Save width and trigger events
              if (finalWidth != oldWidth) {
                if (view.saveColumnWidth) {
                  // Save updated width
                  columnModel.set("width", finalWidth, {silent: true});
                }

                // Trigger event
                view.columns.trigger("resize", columnModel, finalWidth, oldWidth);
              }
              view.updateHandlerPosition();
            };
            $doc.on("mouseup", mouseUpHandler);
          });
        }
      });

      // Position drag handlers
      view.updateHandlerPosition();

      return this;
    },
    /**
     * Helper function to prevent event propagation
     * @param e {Event}
     * @private
     */
    _stopEvent: function (e) {
      if (e.stopPropagation) {
        e.stopPropagation();
      }
      if (e.preventDefault) {
        e.preventDefault();
      }
      e.cancelBubble = true;
      e.returnValue = false;
    },

    /**
     * Add listeners
     * @private
     */
    attachEvents: function () {
      var view = this;
      view.listenTo(view.columns, "change:resizeable", view.render);
      view.listenTo(view.columns, "resize width:auto width:fixed add remove", view.checkSpacerColumn);
      //view.listenTo(view.columns, "width:auto width:fixed", view.updateHandlerPosition);
      view.listenTo(view.grid.collection, "backgrid:colgroup:updated", view.updateHandlerPosition);
      view.listenTo(view.grid.collection, "backgrid:colgroup:changed", function () {
        // Wait for callstack to be cleared
        _.defer(function () {
          view.setHeaderElements();
          view.render();
        });
      });
    },

    /**
     * Checks whether a spacer column is nessecary. This is the case when widths are set on all columns and it's smaller
     * that the grid element width.
     * @private
     */
    checkSpacerColumn: function () {
      var view = this;
      var spacerColumn = _.first(view.columns.where({name: "__spacerColumn"}));
      var autoColumns = view.columns.filter(function (col) {
        return col.get("width") == "*" && col.get("name") != "__spacerColumn";
      });

      // Check if there is a column with auto width, if so, no need to do anything
      if (_.isEmpty(autoColumns)) {
        var totalWidth = view.columns.reduce(function (memo, num) {
          var colWidth = (num.get("width") == "*") ? 0 : num.get("width");
          return memo + colWidth;
        }, 0);
        var gridWidth = view.grid.$el.width();

        if (gridWidth > totalWidth) {
          // The grid is larger than the cumulative column width, we need a spacer column
          if (!spacerColumn) {
            // Create new column model
            view.columns.add(view.getSpacerColumn());
          }
        }
        else {
          // Cumulative column width exceeds grid width, no need for a spacerColumn.
          if (spacerColumn) {
            view.columns.remove(spacerColumn);
          }
        }
      }
      else if (spacerColumn) {
        view.columns.remove(spacerColumn);
      }
    },

    /**
     * Returns a spacer column definition
     * @returns Object
     * @private
     */
    getSpacerColumn: function() {
      return Backgrid.Extension.SizeAbleColumns.spacerColumnDefinition;
    },

    /**
     * Updates the position of the handlers
     * @private
     */
    updateHandlerPosition: function () {
      var view = this;
      _.each(view.headerElements, function (columnEl, index) {
        var $column = $(columnEl);

        // Get handler for current column and update position
        view.$el.children().filter("[data-column-index='" + index + "']")
          .css("left", $column.position().left + $column.outerWidth());
      });
    },

    /**
     * Find the current header elements and stores them
     */
    setHeaderElements: function () {
      var view = this;
      var $headerEl = view.grid.header.$el;
      var $rows = $headerEl.children("tr");
      view.headerElements = [];

      // Loop rows to find header cells; currently this method does not support header columns with a colspan > 1.
      if ($rows.length < 2) {
        view.headerElements = $rows.children();
      }
      else {
        // Get all rows in the header
        var rowAmount = $rows.length;
        $rows.each(function (index, row) {
          // Loop all cells
          $(row).children("th").each(function (ind, cell) {
            var $cell = $(cell);
            if (($cell.attr("colspan") == 1 || typeof $cell.attr("colspan") == "undefined") &&
              ($cell.attr("rowspan") == rowAmount - index ||
                (index + 1 === rowAmount && typeof $cell.attr("rowspan") == "undefined"))) {
              view.headerElements.push(cell);
            }
          });
        });

        // Sort array
        view.headerElements.sort(function (lhs, rhs) {
          return parseInt($(lhs).offset().left, 10) - parseInt($(rhs).offset().left, 10);
        });
      }
    }
  });

  /**
   * Sample definition for the spacer column
   */
  Backgrid.Extension.SizeAbleColumns.spacerColumnDefinition = {
    name: "__spacerColumn",
    label: "",
    editable: false,
    cell: Backgrid.StringCell,
    width: "*",
    nesting: [],
    resizeable: false,
    sortable: false,
    orderable: false,
    displayOrder: 9999
  };
  return Backgrid;
}));

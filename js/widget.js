/**
 *  Widget system for Prototype JavaScript framework (Sam Stephenson)
 *  Widget base Class
 *  2009, Dimitri Avenel
 *  This code is freely distributable under the terms of an MIT-style license.
 **/
 
/*
FIXME Uniquement W3C pour le moment, version IE a creer (attachEvent, focusin ?)
TODO Widgets a faire : button, select, table, checklist, calendar, slider
*/


Prototype.Widgets = {}; // Widgets collection

(function() {
	// Global observer : Capture event from one widget, and propagate it to all Widget instances
	var overHandler  = function(e) {
		e.stop();
		document.fire('global:widget:over' , { element:e.findElement() });
	};
	var leaveHandler = function(e) {
		e.stop();
		document.fire('global:widget:leave', { element:e.findElement() });
	};
	var focusHandler  = function(e) {
		document.fire('global:widget:focus', { element:e.findElement() });
	};
	document.observe('widget:global:over' , overHandler );
	document.observe('widget:global:leave', leaveHandler);
	document.observe('widget:global:focus', focusHandler);
	/*if(document.addEventListener) {
		document.addEventListener('focus:in', focusHandler, true);
	}*/
	if(document.addEventListener) {
		document.addEventListener("focus", focusHandler, true);
		//document.addEventListener("blur", blurHandler, true);
	} else {
		document.observe("focusin", focusHandler);
		//document.observe("focusout", focusOutHandler);
	}
	//document.observe('click', focusHandler);
})();

document.observe('dom:loaded', function() {
	document.body.tabIndex = 0; // Force body focus to fix cross-browser widget's blur event
});

Prototype.Widget = Class.create({
	initialize: function(className, el) {
		
		// Options
		this.opt = {
			className: className || '',
			debug: true,
			debugEventFilter: ['ajax'] // global|mouse|focus|blur|ajax...
		};
		
		// UI bindings
		this.dom = {
			element : $(el) || new Element('div')
		};
		this.dom.element.writeAttribute('tabindex', '0'); // widget base element is focusable
		this.dom.element.widget = this;
		
		// Variables
		this.vars = {
			over  : false, // widget over tracking
			focus : false, // widget focus tracking
			focusables : []
		};
		
		// Observers
		this.observers = {};
			
		// Send event to Global observer
		this.dom.element.observe('mouseover', function(e) {
			e.stop();
			if( !this.vars.over ) {
				this.fire('global:over');
			}
		}.bind(this));
		this.dom.element.observe('mouseleave', function(e) {
			e.stop();
			this.fire('global:leave');
		}.bind(this));

		// Receive event from Global observer
		document.observe('global:widget:over', function(e) {
			var old = this.vars.over;
			this.vars.over = ( e.memo.element === this.dom.element );
			if( this.vars.over !== old ) {
				if( this.vars.over ) {
					this.dom.element.addClassName('over');
					this.fire('mouse:over');
				} else {
					this.dom.element.removeClassName('over');
					this.fire('mouse:out');
				}
			}
		}.bind(this));
		document.observe('global:widget:leave', function(e) {
			if( e.memo.element === this.dom.element ) {
				this.vars.over = false;
				this.dom.element.removeClassName('over');
				this.fire('mouse:out');
			}
		}.bind(this));
		document.observe('global:widget:focus', function(e) {
			if( this.vars.focusables.include(e.memo.element) ) { //e.memo.element === this.dom.element
				if( !this.vars.focus ) {
					this.vars.focus = true;
					this.dom.element.addClassName('focus');
					this.fire('focus');
				}
			} else {
				if( this.vars.focus ) {
					this.vars.focus = false;
					this.dom.element.removeClassName('focus');
					this.fire('blur');
				}
			}
		}.bind(this));
		
		this.dom.element
			.addClassName('widget')
			.addClassName(this.opt.className);
	
	},
	// Widget.fire(eventName, handler) -> Widget : Widget version of Element.fire
	fire: function(e, memo) {
		if( this.opt.debug && typeof window.console !== 'undefined' ) {
			if( !this.opt.debugEventFilter.include( e.split(':')[0] ) ) {
				window.console.log('[' + this.opt.className + '] >> ' + 'widget:' + e + '' + ( memo && memo.debug ? ' (debug:"' + memo.debug + '")' : '' ));
			}
		}
		this.dom.element.fire('widget:'+e, memo);
		return this;
	},
	// Widgets.enable() : Start listening
	enable: function() {
		$H( this.observers ).each( function(o) {
			var tmp = o.key.split(':');
			if( this.dom[tmp[0]] ) {
				Event.observe( this.dom[tmp[0]], tmp[1], this.observers[o.key] );
			}
		}.bind(this));
		this.dom.element.removeClassName('disabled');
		return this.fire('enabled');
	},
	// Widgets.disable() : Stop listening
	disable: function() {
		$H( this.observers ).each( function(o) {
			var tmp = o.key.split(':');
			if( this.dom[tmp[0]] ) {
				Event.stopObserving( this.dom[tmp[0]], tmp[1], this.observers[o.key] );
			}
		}.bind(this));
		this.dom.element.addClassName('disabled');
		return this.fire('disabled');
	},
	// Widget.focus() -> Widget : Focus this Widget / Blur all other
	focus: function(e) {
		if( e ) e.stop(); // Fix webkit bug https://lists.webkit.org/pipermail/webkit-unassigned/2009-August/127056.html
		return ( !this.vars.focus ? this.fire('global:focus') : this );
	},
	// Widget.blur() -> Widget : Blur this Widget
	blur: function(e) {
		if( this.vars.focus ) {
			this.vars.focus = false;
			this.dom.element.removeClassName('focus');
			this.fire('blur');
		}
		return this;
	},
	// Widget.bindFocusables() -> Widget : Bind all focusables descendants with this widget (exclude descendant widget's descendants)
	bindFocusables: function() {
		this.vars.focusables.invoke('stopObserving', 'focus:in', this.focus.bind(this));
		var plus = $A( this.dom.element.select('input,button,textarea,select,a,[tabindex]') );
		var minus = $A( this.dom.element.select('.widget, .widget *') );
		this.vars.focusables = plus.findAll(function(el) { return !minus.include(el); }) || [];
		this.vars.focusables.push( this.dom.element );
		this.vars.focusables
			.invoke('stopObserving', 'focus')
			.invoke('observe', 'click', this.focus.bind(this)) // Fix webkit bug https://lists.webkit.org/pipermail/webkit-unassigned/2009-August/127056.html
			.invoke('observe', 'focus', this.focus.bind(this));
		this.dom.element.blur();
		return this;
	},
	// Widget.debug([boolean]) -> Widget : activate/deactivate/toggle event logging in console.
	debug: function(b) {
		this.opt.debug = ( Object.isUndefined( b ) ? !this.opt.debug : b );
		return this;
	}
});


if( !Prototype.Tools ) Prototype.Tools = {};

Prototype.Tools.isValid = {
	'empty': function(v) {
		return ( v === '' );
	},
	'integer': function(v) {
		return ( parseFloat(v) === parseInt(v, 10) );
	},
	'real': function(v) {
		return ( ! isNaN(parseFloat(v)) );
	},
	'date-elements': function(y,m,d) {
		y = parseInt(y, 10);
		m = parseInt(m, 10)-1;
		d = parseInt(d, 10);
		var dt = new Date(y, m, d);
		if( isNaN(dt) ) { return false; }
		return ( dt.getFullYear()===y && dt.getMonth()===m && dt.getDate()===d ); 
	},
	'time-elements': function(h,m,s) {
		h = parseInt(h, 10);
		m = parseInt(m, 10);
		s = parseInt(s, 10);
		return ( h>=0 && h<=24 && m>=0 && m<=59 && s>=0 && s<=59 );
	},
	'date-yyyy-mm-dd': function(v) { // accept yyyy-mm-dd, yyyy/mm/dd
		var m = /^(\d{4})([-\/])(\d{2})\2(\d{2})$/.exec(v);
		if( m === null ) { return false; }
		return ( Prototype.Tools.isValid['date-elements'](m[1], m[3], m[4]) );
	},
	'date-yyyy-mm-dd-hh-nn-ss': function(v) { // accept yyyy-mm-dd hh:nn:ss, yyyy/mm/dd hh:nn:ss
		var m = /^(\d{4})([-\/])(\d{2})\2(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(v);
		if( m === null ) { return false; }
		return (
			Prototype.Tools.isValid['date-elements'](m[1], m[3], m[4]) &&
			Prototype.Tools.isValid['time-elements'](m[5], m[6], m[7])
		);
	},
	'email': function(v) {
		return ( /^[A-Z0-9._%-]+@(?:[A-Z0-9-]+\.)+[A-Z]{2,4}$/.match(v) );
	},
	'phone': function(v) {
		return ( /^(?:\+?\d{2}|0)[1-9]\d{8}$/.match(v) );
	},
	'phone-mobile': function(v) {
		return ( /^(?:\+?\d{2}|0)6\d{8}$/.match(v) );
	},
	'postal-code-fr': function(v) {
		return ( /^\d{5}$/.match(v) );
	},
	'all': function() {
		return true;
	},
	'none': function() {
		return false;
	}
};

import io
import psutil
import matplotlib
matplotlib.use("Agg")  # non-interactive backend, safe for server use
import matplotlib.pyplot as plt
from matplotlib.patches import Wedge
from warnings import warn
from collections import deque


class LiveCPU:

    def __init__(self):
        psutil.cpu_percent()  # prime cpu_percent() to avoid initial 0% reading
        self._history_state = {'t': 0}
        self._cpu_history = deque()
        self._ram_history = deque()
        self._time_history = deque()
        self._max_window = 40  # retention window in seconds, updated on each chart draw

        # cached figures/artists, built lazily on first use of each style
        self._gauge = None
        self._chart = None

    def live_usage(
            self,
            style: str = 'gauge',
            *,
            window: float = None,
            **kw
        ):
        """
        Returns an SVG string of a single, up-to-date frame of a CPU usage graph.

        Parameters
        ----------
        style : str
            Either 'gauge' or 'chart'.
        window : float
            Sliding window size in seconds (only applicable for 'chart' style).
        """

        self.kw = kw  # store additional keyword arguments for later use

        if style == 'gauge':
            if window is not None:
                warn("The 'window' parameter is not applicable for the 'gauge' style and will be ignored.")
            fig = self._draw_gauge()
        elif style == 'chart':
            fig = self._draw_chart(window)
        else:
            raise ValueError(f"Unknown style: {style}, expected 'gauge' or 'chart'.")

        return self._to_svg(fig)

    # ------------------------------------------------------------------ #
    # Gauge
    # ------------------------------------------------------------------ #
    def _build_gauge(self):
        span = self.kw.get('span', 220)
        start_angle = 270 + (360 - span) / 2
        end_angle = start_angle + span

        outer_r, outer_w = 0.82, 0.25
        inner_r, inner_w = 1.00, 0.13

        fig, ax = plt.subplots(
            figsize=(3, 3),
            constrained_layout=self.kw.get('constrained_layout', True),
            dpi=self.kw.get('dpi', 100)
        )

        ax.set_xlim(-1.02, 0.88)
        ax.set_ylim(-0.80, 0.85)
        ax.set_aspect('equal')
        ax.axis('off')

        ram_start = start_angle + self.kw.get('ram_start_offset', -5)
        ram_end   = end_angle   + self.kw.get('ram_end_offset', 45)
        cpu_start = start_angle + self.kw.get('cpu_start_offset', 145)
        cpu_end   = end_angle   + self.kw.get('cpu_end_offset', 25)
        ram_span  = ram_end - ram_start
        cpu_span  = cpu_end - cpu_start

        # Dial edges (static)
        ax.add_patch(Wedge((0, 0), outer_r, ram_start, ram_end,
                                    width=outer_w, facecolor='none', edgecolor=self.kw.get('ram_outline', 'black'), linewidth=0.5, alpha=0.65))
        ax.add_patch(Wedge((0, 0), inner_r, cpu_start, cpu_end,
                            width=inner_w, facecolor='none', edgecolor=self.kw.get('cpu_outline', 'grey'), linewidth=0.5, alpha=0.65))

        # Dial fill (dynamic — created once, updated each frame)
        ram_wedge = Wedge((0, 0), outer_r, ram_end, ram_end,
                                  width=outer_w, facecolor=self.kw.get('ram_c', 'black'))
        cpu_wedge = Wedge((0, 0), inner_r, cpu_end, cpu_end,
                          width=inner_w, facecolor=self.kw.get('cpu_c', 'grey'))
        ax.add_patch(ram_wedge)
        ax.add_patch(cpu_wedge)
        

        ram_text = ax.text(0, 0.18, '0%', ha='center', va='center',
                                   fontsize=self.kw.get('ram_fontsize', 30), color=self.kw.get('ram_c', 'black'))
        cpu_text = ax.text(0, -0.06, '0%', ha='center', va='center',
                           fontsize=self.kw.get('cpu_fontsize', 18), color=self.kw.get('cpu_c', 'grey'))
        ax.text(0, -0.25, 'RAM / CPU', ha='center', va='center',
                fontsize=self.kw.get('label_fontsize', 10), color=self.kw.get('label_color', 'dimgray'))

        ax.set_facecolor(self.kw.get('facecolor', 'none'))
        fig.set_facecolor(self.kw.get('facecolor', 'none'))

        self._gauge = {
            'fig': fig,
            'ram_wedge': ram_wedge, 'cpu_wedge': cpu_wedge, 
            'ram_text': ram_text, 'cpu_text': cpu_text, 
            'ram_end': ram_end, 'ram_span': ram_span,
            'cpu_end': cpu_end, 'cpu_span': cpu_span
        }

    def _draw_gauge(self):
        if self._gauge is None:
            self._build_gauge()

        g = self._gauge
        cpu, ram = self._update()

        ram_fill = g['ram_end'] - g['ram_span'] * (ram / 100)
        cpu_fill = g['cpu_end'] - g['cpu_span'] * (cpu / 100)

        g['ram_wedge'].set_theta1(ram_fill)
        g['ram_wedge'].set_theta2(g['ram_end'])
        g['cpu_wedge'].set_theta1(cpu_fill)
        g['cpu_wedge'].set_theta2(g['cpu_end'])

        g['ram_text'].set_text(f'{ram}%')
        g['cpu_text'].set_text(f'{cpu}%')

        return g['fig']

    # ------------------------------------------------------------------ #
    # Chart
    # ------------------------------------------------------------------ #
    def _build_chart(self):
        fig, ax = plt.subplots(
            figsize=(3.5, 3),
            constrained_layout=self.kw.get('constrained_layout', True),
            dpi=self.kw.get('dpi', 100)
        )

        ram_line, = ax.plot([], [],
                            color=self.kw.get('ram_c', 'black'),
                            linewidth=self.kw.get('ram_linewidth', 2),
                            linestyle=self.kw.get('ram_linestyle', '-'),
                            label='RAM')
        cpu_line, = ax.plot([], [],
                            color=self.kw.get('cpu_c', 'darkgrey'),
                            linewidth=self.kw.get('cpu_linewidth', 1),
                            linestyle=self.kw.get('cpu_linestyle', '--'),
                            label='CPU')

        ax.set_ylim(0, 100)
        ax.grid(True, alpha=0.3)

        ax.tick_params(axis='both', which='both', bottom=False, top=False, left=False, right=False)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_visible(False)
        ax.spines['bottom'].set_color('grey')
        ax.set_xticklabels([])
        ax.set_yticklabels([])

        legend = ax.legend(loc='best') if self.kw.get('show_legend', True) else None

        self._chart = {
            'fig': fig, 'ax': ax,
            'cpu_line': cpu_line, 'ram_line': ram_line,
            'legend': legend,
        }

    def _draw_chart(self, window=None):
        if window is None:
            window = 40  # default window size in seconds

        if self._chart is None:
            self._build_chart()

        c = self._chart

        # keep a small buffer beyond the visible window so trimming isn't overly aggressive
        reserve = self.kw.get('reserve', 10)
        self._max_window = max(self._max_window, window) if window > self._max_window else window

        cpu, ram = self._update()

        t = self._history_state['t']
        self._cpu_history.append(cpu)
        self._ram_history.append(ram)
        self._time_history.append(t)

        self._trim_history(t, window + reserve)

        # Advance time by the caller's expected polling interval (in seconds)
        self._history_state['t'] += self.kw.get('step', 1)

        c['ram_line'].set_data(self._time_history, self._ram_history)
        c['cpu_line'].set_data(self._time_history, self._cpu_history)

        x_max = max(t, window)
        x_min = x_max - window
        c['ax'].set_xlim(x_min, x_max)

        if self.kw.get('show_legend', True):
            c['ram_line'].set_label(f'RAM {ram}%')
            c['cpu_line'].set_label(f'CPU {cpu}%')
            c['legend'] = c['ax'].legend(loc='best')

        return c['fig']

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def _to_svg(self, fig):
        """Render the (already-updated) figure to an SVG string."""
        buf = io.StringIO()
        if self.kw.get('facecolor', 'none') == 'none':
            fig.savefig(buf, format='svg', transparent=True, bbox_inches='tight', pad_inches=0)
        else:
            fig.savefig(buf, format='svg', transparent=False, bbox_inches='tight', pad_inches=0)
        return buf.getvalue()

    def _trim_history(self, t, keep_seconds):
        """Discards history entries older than `keep_seconds` relative to time `t`."""
        cutoff = t - keep_seconds
        while self._time_history and self._time_history[0] < cutoff:
            self._time_history.popleft()
            self._cpu_history.popleft()
            self._ram_history.popleft()

    def _update(self):
        return round(psutil.cpu_percent(interval=None)), round(psutil.virtual_memory().percent)

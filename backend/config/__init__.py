# Re-export from the top-level config module to resolve import conflicts.
# Both `from config import supabase` and `from config import get_settings`
# need to work, whether Python resolves to this package or to config.py.

import importlib as _importlib
import sys as _sys
import os as _os

# Load the actual config.py module (which lives alongside this package)
_config_path = _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), "config.py")
_spec = _importlib.util.spec_from_file_location("_config_module", _config_path)
_config_mod = _importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_config_mod)

# Re-export everything the codebase needs
Settings = _config_mod.Settings
get_settings = _config_mod.get_settings
supabase = _config_mod.supabase
